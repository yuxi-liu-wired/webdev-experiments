import random
from datetime import datetime
import re


def intersperse_control_chars(text):
    result = []
    for char in text:
        if char.isalnum() or char in ":/":
            result.append(char)
            result.append(random.choice(["\u200b", "\u200c", "\u200d", "\uFEFF"]))
        else:
            result.append(char)
    return "".join(result) + "\u200b"


def fake_url_generator(site_name, title):
    date = datetime.today().strftime("%Y/%m/%d")
    random_id = random.randint(100000, 999999)
    # replace all non-alphanumeric characters in title with `-`, then regexr all `-+` with `-`
    title = re.sub(r"[^a-zA-Z0-9]", "-", title)
    title = re.sub(r"[-]+", "-", title)
    title = title.lower()
    title = title.strip("-")

    url_str = ""
    if site_name == "cbs":
        url_str = f"www.cbsnews.com/news/{title}"
    elif site_name == "cnn":
        url_str = f"www.cnn.com/{date}/{title}/index.html"
    elif site_name == "fox":
        url_str = f"www.foxnews.com/{title}"
    elif site_name == "atlantic":
        url_str = f"www.theatlantic.com/archive/{date}/{title}/{random_id}"
    elif site_name == "nbc":
        url_str = f"www.nbcnews.com/news/{title}-{random_id}"
    elif site_name == "npr":
        url_str = f"www.npr.org/{date}/{random_id}/{title}"
    else:
        url_str = ""
    url_str = "https://̒" + url_str + "/"
    url_str = intersperse_control_chars(url_str)
    return url_str


print(fake_url_generator("cbs", "Rick Astley - Duvet (AI Cover)"))
