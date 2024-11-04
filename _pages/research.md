---
layout: archive
title: "Research"
permalink: /research/
author_profile: true
---

My academic career focuses on the integration of business studies, operations research and geospatial data science, especially in the fields of using artificial intelligence to assist consumer analytics, location management, and network planning. This interdisciplinary approach effectively merges theoretical business models with advanced spatial analysis and robust data science methodologies, offering profound insights into consumer behaviours, strategic business planning, and evolving market dynamics.

During my academic journey, I've also engaged with complex spatial dimensions of socioeconomic disparities, with a focus on public health and crime. Leveraging statistical models, spatial analysis, and network analytics, my research aims to enhance the precision and utility of geospatial data. This approach aids in identifying and addressing the unequal impacts on marginalized communities, ensuring a more equitable distribution of resources and services.

Recently, I've ventured into new research domains, utilizing machine/deep learning to explore the nuanced realms of environmental monitoring and quantitative finance. These studies aim to reveal underlying patterns and insights in the nascent applications of AI, expanding my understanding and capabilities within these fields.




<nbsp>

{% include base_path %}

{% assign ordered_pages = site.research | sort:"title" %}

{% for post in ordered_pages %}
  {% include archive-single.html type="grid" %}
{% endfor %}

