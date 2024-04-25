---
layout: archive
title: "Media"
permalink: /media/
author_profile: true
---


I enjoy travelling immensely and am delighted to share these wonderful experiences with you!



# Asia

> ## China

<div class="gallery">
{% for image in site.static_files %}
  {% if image.path contains 'china' %}
    <img src="{{ image.path | prepend: site.baseurl }}" alt="China">
  {% endif %}
{% endfor %}
</div>

> ## Japan

<div class="gallery">
{% for image in site.static_files %}
  {% if image.path contains 'japan' %}
    <img src="{{ image.path | prepend: site.baseurl }}" alt="Japan">
  {% endif %}
{% endfor %}
</div>


# North America

> ## Canada

<div class="gallery">
{% for image in site.static_files %}
  {% if image.path contains 'canada' %}
    <img src="{{ image.path | prepend: site.baseurl }}" alt="Canada">
  {% endif %}
{% endfor %}
</div>

> ## United States

<div class="gallery">
{% for image in site.static_files %}
  {% if image.path contains 'united_states' %}
    <img src="{{ image.path | prepend: site.baseurl }}" alt="United States">
  {% endif %}
{% endfor %}
</div>


# Europe

> ## United Kingdom

<div class="gallery">
{% for image in site.static_files %}
  {% if image.path contains 'united_kingdom' %}
    <img src="{{ image.path | prepend: site.baseurl }}" alt="United Kingdom">
  {% endif %}
{% endfor %}
</div>