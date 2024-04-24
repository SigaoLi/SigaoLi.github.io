---
title: "Europe"
layout: single-portfolio
excerpt: "<img src='/images/research/IMG_20220818_163936.jpg' alt=''>"
collection: research
order_number: 30
header: 
  og_image: "research/IMG_20220818_163936.jpg"
---



## United Kingdom

{% for image in site.static_files %}
  {% if image.path contains 'images/media/united_kingdom' %}
    ![Canada]({{ image.path }})
  {% endif %}
{% endfor %}
