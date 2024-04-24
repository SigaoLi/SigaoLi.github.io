---
layout: archive
title: "Research"
permalink: /research/
author_profile: true
header:
  og_image: "research/ecdf.png"
---

My academic and professional research focuses on the application of geospatial and data analysis techniques to address complex real-world problems, ranging from urban planning to environmental monitoring. With a robust background in Geospatial Analysis, I have pursued projects that integrate advanced analytical tools to enhance data accuracy and utility.



<nbsp>

{% include base_path %}

{% assign ordered_pages = site.research | sort:"title" %}

{% for post in ordered_pages %}
  <div class="full-width-item"> <!-- Container for full width -->
    <div class="grid-item">
      {% include archive-single.html type="grid" %}
    </div>
  </div>
{% endfor %}

