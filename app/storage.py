import json
import re
import sqlite3
from contextlib import contextmanager
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DATA_DIR = ROOT / 'data'
DATABASE = DATA_DIR / 'assistant.sqlite3'
DEFAULT_SLOTS = [
    {'key': 'LW', 'position': 'LW'}, {'key': 'ST', 'position': 'ST'}, {'key': 'RW', 'position': 'RW'},
    {'key': 'LCM', 'position': 'CM'}, {'key': 'RCM', 'position': 'CM'}, {'key': 'CDM', 'position': 'CDM'},
    {'key': 'LB', 'position': 'LB'}, {'key': 'LCB', 'position': 'CB'}, {'key': 'RCB', 'position': 'CB'},
    {'key': 'RB', 'position': 'RB'}, {'key': 'GK', 'position': 'GK'},
]
DEFAULT_SUBSTITUTES = [{'key': f'SUB{index}', 'position': ''} for index in range(1, 8)]
TEAM_TACTIC_TEXT_FIELDS = ('defense_style', 'build_up', 'chance_creation', 'mentality')
TEAM_TACTIC_NUMBER_FIELDS = ('defense_width', 'defense_depth', 'attack_width', 'players_in_box', 'corners', 'free_kicks')


def validate_tactics(squad):
    team = squad.get('team_tactics', {})
    if not isinstance(team, dict) or not set(team).issubset(TEAM_TACTIC_TEXT_FIELDS + TEAM_TACTIC_NUMBER_FIELDS):
        raise ValueError('球队战术格式无效。')
    for field in TEAM_TACTIC_TEXT_FIELDS:
        if field in team and (not isinstance(team[field], str) or len(team[field]) > 100):
            raise ValueError('球队战术文字无效。')
    for field in TEAM_TACTIC_NUMBER_FIELDS:
        if field in team and (type(team[field]) is not int or not 0 <= team[field] <= 100):
            raise ValueError('球队战术数值必须为 0 至 100 的整数。')
    for slot in squad['slots']:
        tactics = slot.get('personal_tactics', {})
        if not isinstance(tactics, dict) or not set(tactics).issubset(('instructions', 'attack_work_rate', 'defense_work_rate')):
            raise ValueError('个人战术格式无效。')
        for field in ('attack_work_rate', 'defense_work_rate'):
            if field in tactics and (type(tactics[field]) is not int or not 0 <= tactics[field] <= 99):
                raise ValueError('个人战术倾向必须为 0 至 99 的整数。')
        instructions = tactics.get('instructions', [])
        if not isinstance(instructions, list) or len(instructions) > 6:
            raise ValueError('个人战术最多填写 6 项。')
        codes = set()
        for item in instructions:
            if not isinstance(item, dict) or set(item) != {'code', 'value'} or not isinstance(item['code'], str) or not re.fullmatch(r'[A-Z]{1,4}', item['code']) or type(item['value']) is not int or not 0 <= item['value'] <= 99:
                raise ValueError('个人战术需填写 1 至 4 位英文字母缩写和 0 至 99 的整数。')
            if item['code'] in codes:
                raise ValueError('同一位置的个人战术缩写不能重复。')
            codes.add(item['code'])


def has_tactics(squad):
    if any(value not in ('', None) for value in squad.get('team_tactics', {}).values()):
        return True
    return any(slot.get('personal_tactics', {}).get('instructions') or any(field in slot.get('personal_tactics', {}) for field in ('attack_work_rate', 'defense_work_rate')) for slot in squad.get('slots', []))


@contextmanager
def connect():
    DATA_DIR.mkdir(exist_ok=True)
    connection = sqlite3.connect(DATABASE, timeout=10)
    try:
        with connection:
            connection.execute('CREATE TABLE IF NOT EXISTS players (id TEXT PRIMARY KEY, data TEXT NOT NULL)')
            connection.execute('CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT NOT NULL)')
            connection.execute('CREATE TABLE IF NOT EXISTS secrets (provider TEXT PRIMARY KEY, ciphertext BLOB NOT NULL)')
            yield connection
    finally:
        connection.close()


def save_player(player):
    with connect() as connection:
        connection.execute('INSERT OR REPLACE INTO players (id, data) VALUES (?, ?)', (player['id'], json.dumps(player, ensure_ascii=False)))
    return player


def get_player(identifier):
    with connect() as connection:
        row = connection.execute('SELECT data FROM players WHERE id = ?', (identifier,)).fetchone()
    return json.loads(row[0]) if row else None


def search_players(query=''):
    with connect() as connection:
        rows = connection.execute('SELECT data FROM players').fetchall()
    players = [json.loads(row[0]) for row in rows]
    query = query.casefold().strip()
    if query:
        players = [player for player in players if query in ' '.join(str(player.get(key, '')) for key in ('name', 'season', 'position', 'id')).casefold()]
    return sorted(players, key=lambda player: player.get('fetched_at', ''), reverse=True)


def default_squad():
    return {'name': '曼联队套', 'formation': '4-1-2-3', 'mode': '手动排位', 'notes': '', 'slots': [dict(slot) for slot in DEFAULT_SLOTS], 'substitutes': [dict(slot) for slot in DEFAULT_SUBSTITUTES]}


def with_substitutes(squad):
    if 'substitutes' not in squad:
        return {**squad, 'substitutes': [dict(slot) for slot in DEFAULT_SUBSTITUTES]}
    return squad


def get_squad():
    with connect() as connection:
        row = connection.execute('SELECT value FROM settings WHERE key = ?', ('squad',)).fetchone()
    return with_substitutes(json.loads(row[0])) if row else default_squad()


def validate_squad(squad, player_ids=None):
    if not isinstance(squad, dict) or not isinstance(squad.get('slots'), list) or len(squad['slots']) != 11:
        raise ValueError('阵容必须包含 11 个位置。')
    if any(not isinstance(slot, dict) for slot in squad['slots']):
        raise ValueError('阵容位置无效，请刷新页面重试。')
    if [slot.get('key') for slot in squad['slots']] != [slot['key'] for slot in DEFAULT_SLOTS]:
        raise ValueError('阵容位置无效，请刷新页面重试。')
    substitutes = squad.get('substitutes', [dict(slot) for slot in DEFAULT_SUBSTITUTES])
    if not isinstance(substitutes, list) or len(substitutes) != len(DEFAULT_SUBSTITUTES) or any(not isinstance(slot, dict) for slot in substitutes) or [slot.get('key') for slot in substitutes] != [slot['key'] for slot in DEFAULT_SUBSTITUTES]:
        raise ValueError('替补席位无效，请刷新页面重试。')
    if any(not set(slot).issubset(('key', 'position', 'name', 'season', 'level', 'player_id')) for slot in substitutes):
        raise ValueError('替补球员字段无效。')
    for slot in squad['slots'] + substitutes:
        if not isinstance(slot.get('position', ''), str) or len(slot.get('position', '')) > 12:
            raise ValueError('位置名称无效。')
        identifier = slot.get('player_id')
        if identifier is not None and not isinstance(identifier, str):
            raise ValueError('球员 ID 无效。')
        if identifier and (identifier not in player_ids if player_ids is not None else not get_player(identifier)):
            raise ValueError('球员不在本地缓存中，请先添加球员详情。')
        for field in ('name', 'season', 'level'):
            if not isinstance(slot.get(field, ''), str) or len(slot.get(field, '')) > 100:
                raise ValueError('球员信息过长或格式不正确。')
    for field in ('name', 'formation', 'mode', 'notes'):
        if not isinstance(squad.get(field, ''), str) or len(squad.get(field, '')) > 2000:
            raise ValueError('阵容信息格式不正确。')
    validate_tactics(squad)
    return squad


def save_squad(squad):
    if not isinstance(squad, dict) or 'substitutes' not in squad:
        raise ValueError('阵容缺少替补席位，请刷新页面或更新客户端后重试。')
    validate_squad(squad)
    with connect() as connection:
        connection.execute('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)', ('squad', json.dumps(squad, ensure_ascii=False)))
    return squad
