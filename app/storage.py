import json
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
    return {'name': '曼联队套', 'formation': '4-1-2-3', 'mode': '手动排位', 'notes': '', 'slots': [dict(slot) for slot in DEFAULT_SLOTS]}


def get_squad():
    with connect() as connection:
        row = connection.execute('SELECT value FROM settings WHERE key = ?', ('squad',)).fetchone()
    return json.loads(row[0]) if row else default_squad()


def validate_squad(squad, player_ids=None):
    if not isinstance(squad, dict) or not isinstance(squad.get('slots'), list) or len(squad['slots']) != 11:
        raise ValueError('阵容必须包含 11 个位置。')
    if any(not isinstance(slot, dict) for slot in squad['slots']):
        raise ValueError('阵容位置无效，请刷新页面重试。')
    if [slot.get('key') for slot in squad['slots']] != [slot['key'] for slot in DEFAULT_SLOTS]:
        raise ValueError('阵容位置无效，请刷新页面重试。')
    for slot in squad['slots']:
        if not isinstance(slot.get('position', ''), str) or len(slot['position']) > 12:
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
    return squad


def save_squad(squad):
    validate_squad(squad)
    with connect() as connection:
        connection.execute('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)', ('squad', json.dumps(squad, ensure_ascii=False)))
    return squad
