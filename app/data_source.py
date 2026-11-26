import html
import re
import urllib.error
import urllib.request
from datetime import datetime, timezone
from html.parser import HTMLParser
from urllib.parse import urlparse

BASE_URL = 'https://cn.fifaaddict.com'
USER_AGENT = 'FCOnlineLocalAssistant/1.0 (personal use)'


class MetaParser(HTMLParser):
    def __init__(self):
        super().__init__()
        self.description = ''
        self.title = ''
        self.in_title = False

    def handle_starttag(self, tag, attrs):
        attributes = dict(attrs)
        if tag == 'meta' and attributes.get('name') == 'description':
            self.description = attributes.get('content', '')
        if tag == 'title':
            self.in_title = True

    def handle_endtag(self, tag):
        if tag == 'title':
            self.in_title = False

    def handle_data(self, data):
        if self.in_title:
            self.title += data


class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None


def player_id(value):
    value = value.strip()
    if re.fullmatch(r'[a-z0-9]{5,20}', value):
        return value
    parsed = urlparse(value)
    if parsed.scheme != 'https' or parsed.netloc.lower() != 'cn.fifaaddict.com':
        raise ValueError('请输入 cn.fifaaddict.com 的球员详情链接。')
    match = re.fullmatch(r'/fo4db/pid([a-z0-9]{5,20})/?', parsed.path)
    if not match:
        raise ValueError('链接格式不正确，请粘贴球员详情页链接。')
    return match.group(1)


def first(pattern, text, default=None):
    match = re.search(pattern, text)
    return match.group(1) if match else default


def fetch_player(value):
    identifier = player_id(value)
    url = f'{BASE_URL}/fo4db/pid{identifier}'
    request = urllib.request.Request(url, headers={'User-Agent': USER_AGENT, 'Accept': 'text/html'})
    try:
        with urllib.request.build_opener(NoRedirect).open(request, timeout=15) as response:
            raw = response.read(2_000_001)
    except (urllib.error.URLError, TimeoutError, OSError) as exc:
        raise ValueError('无法访问球员详情，请检查网络或稍后重试。') from exc
    if len(raw) > 2_000_000:
        raise ValueError('球员页面过大，无法安全解析。')
    text = raw.decode('utf-8', errors='replace')
    parser = MetaParser()
    parser.feed(text)
    description = html.unescape(parser.description).strip()
    match = re.match(r'(.+?)（(.+?)），', description)
    ovr = first(r'总评\(OVR\)为(\d+)', description)
    if not match or not ovr or 'foPlayerSSRdb' not in text:
        raise ValueError('球员页面结构发生变化或数据不完整，请核对链接。')
    primary_position = first(r'司职([^，。]+)', description, '未知')
    team = first(r'效力于\s*(.+?)\s*俱乐部', description, '')
    height = first(r'身高(\d+)厘米', description)
    weight = first(r'体重(\d+)公斤', description)
    weak_foot = first(r'逆足\s*(\d)', description)
    attributes_part = first(r'主要能力值包括：([^。]+)', description, '')
    attributes = {name.strip(): int(number) for name, number in re.findall(r'([^、\s]+)\s+(\d+)', attributes_part)}
    traits = []
    for trait in re.findall(r'<a href="/fo4db\?trait=[^"]+">([^<]+)</a>', text):
        if trait not in traits:
            traits.append(html.unescape(trait))
    return {
        'id': identifier,
        'name': match.group(1),
        'season': match.group(2),
        'ovr': int(ovr),
        'position': primary_position,
        'club': team,
        'height_cm': int(height) if height else None,
        'weight_kg': int(weight) if weight else None,
        'weak_foot': int(weak_foot) if weak_foot else None,
        'attributes': attributes,
        'attributes_note': '仅收录页面摘要公开的主要能力；其余能力未获取。',
        'traits': traits,
        'description': description,
        'source_url': url,
        'fetched_at': datetime.now(timezone.utc).isoformat(),
        'data_note': '第三方中文站数据，非国服官方实时数据；未计算强化及队套加成。',
    }
