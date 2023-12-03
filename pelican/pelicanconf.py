AUTHOR = 'Yuxi Liu'
SITENAME = 'Yuxi on the Wire'
SITEURL = ""

PATH = "content"

TIMEZONE = 'America/Los_Angeles'

DEFAULT_LANG = 'en'

# Static files
STATIC_PATHS = ['articles', 'pages',
                "extras", "images", "documents"]

# Feed generation is usually not desired when developing
FEED_ALL_ATOM = None
CATEGORY_FEED_ATOM = None
TRANSLATION_FEED_ATOM = None
AUTHOR_FEED_ATOM = None
AUTHOR_FEED_RSS = None

DISPLAY_PAGES_ON_MENU = True

# Blogroll
LINKS = (
    ("Gwern.net", "https://gwern.net/"),
    ("Lil'Log", "https://lilianweng.github.io/"),
)

# Social widget
SOCIAL = (
    ("GitHub", "https://github.com/yuxiliu1995"),
    ("Email", "mailto:yuxi_liu@berkeley.edu"),
)

DEFAULT_PAGINATION = 10

SHOW_SOURCE_ALL_POSTS = True 
SHOW_SOURCE_IN_SECTION = True

# Uncomment following line if you want document-relative URLs when developing
# RELATIVE_URLS = True

EXTRA_PATH_METADATA = {
    'extras/favicon.ico': {'path': 'favicon.ico'},
}

# PLUGIN_PATHS = ['plugins']
# PLUGINS = ['pelican_cite']

# Bibliography

PUBLICATIONS_SRC = 'content/extras/test.bib'
# PUBLICATIONS_SRC = ['content/pubs1.bib', 'content/pubs2.bib', 'content/pubs3.bib']
