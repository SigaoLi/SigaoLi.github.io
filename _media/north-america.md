---
title: "North America"
layout: single-portfolio
excerpt: "<img src='/images/research/IMG_20180814_125058.jpg' alt=''>"
collection: research
order_number: 30
header: 
  og_image: "research/IMG_20180814_125058.jpg"
---



## Canada

{% for image in site.static_files %}
  {% if image.path contains 'images/media/canada' %}
    ![Canada]({{ image.path }})
  {% endif %}
{% endfor %}


## United States

{% for image in site.static_files %}
  {% if image.path contains 'images/media/united_states' %}
    ![Canada]({{ image.path }})
  {% endif %}
{% endfor %}
