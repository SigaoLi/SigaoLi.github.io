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
  {% if image.path contains 'china' %}
    ![China]({{ image.path | prepend: site.baseurl }})
  {% endif %}
{% endfor %}

## Japan

{% for image in site.static_files %}
  {% if image.path contains 'japan' %}
    ![Japan]({{ image.path | prepend: site.baseurl }})
  {% endif %}
{% endfor %}

## United Kingdom

{% for image in site.static_files %}
  {% if image.path contains 'united_kingdom' %}
    ![United Kingdom]({{ image.path | prepend: site.baseurl }})
  {% endif %}
{% endfor %}

## Canada

{% for image in site.static_files %}
  {% if image.path contains 'canada' %}
    ![Canada]({{ image.path | prepend: site.baseurl }})
  {% endif %}
{% endfor %}

## United States

{% for image in site.static_files %}
  {% if image.path contains 'united_states' %}
    ![United States]({{ image.path | prepend: site.baseurl }})
  {% endif %}
{% endfor %}
