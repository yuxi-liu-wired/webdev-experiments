# Pelican blogging (abandoned)

Fuck Pelican.

## What is it?

This is a simple blog engine based on [Pelican](http://blog.getpelican.com/).

## How to run it?

```bash
python -m pip install "pelican[markdown]"

pelican-quickstart

pelican content -s pelicanconf.py
pelican --autoreload --listen
```

## Bibliography

```bash
pip install pybtex
```

## Optional 

```bash
python -m pip install pelican-yaml-metadata
python -m pip install pelican-render-math
python -m pip install pelican-show-source

```

To use the `pelican-show-source` plugin, add the following to whatever theme you are using.

```html
{% if SHOW_SOURCE_IN_SECTION %}
    {% if article and article.show_source_url %}
    <section class="well" id="show-source">
        <h4>This Page</h4>
        <ul>
            <a href="{{ SITEURL }}/{{ article.show_source_url }}">Show source</a>
        </ul>
    </section>
    {% endif %}
{% endif %}
```