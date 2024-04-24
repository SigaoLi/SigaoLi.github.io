---
layout: archive
title: "Research"
permalink: /research/
author_profile: true
header:
  og_image: "research/ecdf.png"
---

My academic and professional research focuses on the application of geospatial and data analysis techniques to address complex real-world problems, ranging from urban planning to environmental monitoring. With a robust background in Geographic Analysis and Spatial Analysis, I have pursued projects that integrate advanced analytical tools to enhance data accuracy and utility.

## Business and Economic Geography
My research in business geography began with my undergraduate thesis, "The Impact of Population Distribution in the Toronto Census Metropolitan Area on Ethnic Retail Location," which analyzed how demographic factors influence retail strategies. This continued with my Master's thesis on "Analyzing Lowe’s Failure in Canada from a Geographical Perspective," where I assessed how geographical insights could predict and explain business outcomes in retail.

## Health Geography
In health geography, I have applied spatial data analysis to understand the relationships between consumer behavior, health outcomes, and urban environment accessibility. Notably, I contributed to a research project examining the presence and magnitude of the Modifiable Areal Unit Problem at various levels of geographic data aggregation in Ontario Health Central, aiming to optimize data utility for health services planning.

## Crime and Safety
My interest in crime mapping led to the development of a project titled "Hotspot Policing for the City of Toronto," which won the President’s Prize at the Canadian Cartographic Association Mapping Competition. This work aimed to designate priority areas for police resource allocation. Additionally, I analyzed homicide types in Toronto to provide actionable insights for crime prevention and resource management.

## Natural Environment Monitoring
Leveraging AI in environmental monitoring, I have developed projects such as a deep learning model for forest fire detection using satellite imagery, achieving over 97% accuracy. This project showcased the potential of integrating AI with natural science to predict and respond to environmental disasters effectively.


<nbsp>

{% include base_path %}

{% assign ordered_pages = site.research | sort:"order_number" %}

{% for post in ordered_pages %}
  {% include archive-single.html type="grid" %}
{% endfor %}
