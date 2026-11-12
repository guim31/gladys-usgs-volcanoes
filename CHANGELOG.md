# Changelog

All notable changes to this integration are documented in this file. The format
follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project
uses [semantic versioning](https://semver.org/).

Describe each change under `## [Unreleased]

### Added

- One device per followed US volcano (names, volcano numbers or observatory
  codes): Volcano Alert Level, Aviation Color Code and newest USGS notice, read
  from the public HANS API of the USGS.
- A "Nearby volcanoes" device: highest alert level within a radius of the
  house, number of volcanoes above normal, and the volcano concerned.
- A dashboard widget listing the volcanoes, most active first, with their
  notices and USGS pages.
- A scene trigger when the alert level or the color code of a followed or
  nearby volcano changes, and a scene action reading the levels as one
  sentence.
- Texts and documentation in English, French, German and Spanish.
