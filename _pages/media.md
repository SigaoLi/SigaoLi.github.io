---
layout: archive
title: "Media"
permalink: /media/
author_profile: true
header:
  og_image: "research/ecdf.png"
---


I enjoy travelling immensely and am delighted to share these wonderful experiences with you!



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

## United Kingdom

{% for image in site.static_files %}
  {% if image.path contains 'images/media/united_kingdom' %}
    ![United Kingdom]({{ image.path }})
  {% endif %}
{% endfor %}

## Canada

{% for image in site.static_files %}
  {% if image.path contains 'images/media/canada' %}
    ![Canada]({{ image.path }})
  {% endif %}
{% endfor %}

## United States

{% for image in site.static_files %}
  {% if image.path contains 'images/media/united_states' %}
    ![United States]({{ image.path }})
  {% endif %}
{% endfor %}
