---
title: "Asia"
layout: single-portfolio
excerpt: "<img src='/images/research/IMG_20180109_151113.jpg' alt=''>"
collection: research
order_number: 30
header: 
  og_image: "research/IMG_20180109_151113.jpg"
---



## China

{% for image in site.static_files %}
  {% if image.path contains 'images/media/china' %}
    ![China]({{ image.path }})
  {% endif %}
{% endfor %}


## Japan

{% for image in site.static_files %}
  {% if image.path contains 'images/media/japan' %}
    ![Japan]({{ image.path }})
  {% endif %}
{% endfor %}