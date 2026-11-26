from app.storage import get_player


def summarize(squad):
    players = []
    for slot in squad.get('slots', []):
        player = get_player(slot['player_id']) if slot.get('player_id') else None
        entry = {'slot': slot.get('key'), 'position': slot.get('position'), 'confirmed_name': slot.get('name', ''), 'confirmed_season': slot.get('season', ''), 'enhancement': slot.get('level', '')}
        if player:
            entry['data'] = {key: player.get(key) for key in ('id', 'name', 'season', 'ovr', 'position', 'club', 'height_cm', 'weight_kg', 'weak_foot', 'attributes', 'attributes_note', 'traits', 'source_url', 'fetched_at', 'data_note')}
        players.append(entry)
    return {'team': squad.get('name'), 'formation': squad.get('formation'), 'mode': squad.get('mode'), 'notes': squad.get('notes'), 'players': players, 'limitations': ['数据来自独立第三方中文站，无法确认国服上架或实时性。', '能力只包括页面摘要显示的主要属性，基础数值不含用户填写的强化和队套加成。', '缺失和未确认的数据不能推断为事实。']}
