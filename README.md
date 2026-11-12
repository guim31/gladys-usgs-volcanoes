# USGS Volcanoes for Gladys Assistant

An external integration for [Gladys Assistant](https://gladysassistant.com) that follows the alert
levels of the US volcanoes monitored by the
[USGS Volcano Hazards Program](https://www.usgs.gov/programs/VHP): Hawaii, Alaska, the Cascades,
California, Yellowstone, the Northern Mariana Islands and American Samoa.

- **One device per followed volcano**: Volcano Alert Level (Normal, Advisory, Watch, Warning), Aviation
  Color Code (Green to Red) and the newest USGS notice, with their history.
- **Nearby volcanoes**: the highest alert level within a radius of your house, the number above normal,
  and the volcano concerned.
- **Dashboard widget**: your volcanoes, most active first, with their notices and USGS pages.
- **Scene trigger** `alert_changed`: the level or color code of a followed or nearby volcano changes
  (filters: new level, new color, raised or lowered).
- **Scene action** `read_volcanoes`: the levels as one sentence, for a message or a voice announcement.

No account, no API key: the data come from the public
[HANS API](https://volcanoes.usgs.gov/hans-public/api/) of the USGS. This is not a safety alert system.
Not affiliated with the USGS.

## Requirements

- Gladys Assistant **5.3.0** or later.
- Internet access from the Gladys host (`volcanoes.usgs.gov`).
- For the nearby volcanoes: a location for your house in Gladys, or coordinates in the configuration.

## Installation

1. In Gladys, open **Integrations → Install from GitHub** and enter
   `https://github.com/guim31/gladys-usgs-volcanoes` (or install it from the catalog once it is
   listed). The install screen shows the **location** access it asks for (the centre of the radius).
2. In **Configuration**, type the volcanoes to follow (`Kilauea, Mount Rainier`, a volcano number, or an
   observatory code such as `cvo`), choose the radius, then save. **Show the current levels** checks
   what your settings catch.
3. Open the **Discover** tab and add the devices.

The user guide is in [`docs/en.md`](docs/en.md) ([français](docs/fr.md), [Deutsch](docs/de.md),
[español](docs/es.md)); Gladys links it from the Configuration screen.

## How it works

```
Integration container ──HTTPS──▶ volcanoes.usgs.gov/hans-public/api
      │ SDK (WebSocket + host API)        volcano/getMonitoredVolcanoes   every refresh
      ▼                                   volcano/getCapElevated          every refresh (synopses)
Gladys core ── devices, states,           volcano/getUSVolcanoes          once a day (positions)
               scene events, widget
```

- Every 10, 15, 30 or 60 minutes the container reads the ~70 monitored volcanoes and their levels. The
  devices are published with `should_poll: false`: the container refreshes them on its own timer (the
  core does not poll external devices reliably, GladysAssistant/Gladys#3198).
- Names typed by the user are matched against the HANS names (case, accents and "Mount" ignored), the
  Smithsonian volcano numbers (the stable device ids), the USGS volcano codes and the observatory codes.
- The last level of every monitored volcano is kept under `/data`: a restart fires no trigger for a
  change already seen (one that happened while stopped fires at the next start), and a newly followed
  volcano fires nothing.

## Limitations

- Only the US volcanoes monitored in real time have a level; the others cannot be followed.
- HANS does not give the date of the last level change: the integration knows it once it has seen one,
  and the history of the feature in Gladys keeps it.
- Notices and synopses are in English, as the USGS writes them.
- Developed and tested against the real HANS service and the SDK's fake Gladys, without a real Gladys
  instance: feedback welcome.

## Development

```bash
npm ci
npm run format:check && npm run lint && npm test
npx -y github:GladysAssistant/integration-store --skip-image-check .
```

The tests run against the SDK's fake Gladys and a fake HANS serving the real answers recorded on
12/11/2026 (`test/fixtures/hans/`): never the network.

## Credits

- Data: [USGS Volcano Hazards Program](https://www.usgs.gov/programs/VHP) and its observatories (AVO,
  CalVO, CVO, HVO, YVO), through [HANS](https://volcanoes.usgs.gov/hans-public/). USGS data are in the
  public domain. The cover is a plain pictogram: the USGS visual identity is reserved to the USGS.
- Home Assistant has no USGS volcano integration; nothing is copied from another project.
- Built on the [Gladys integration SDK](https://github.com/GladysAssistant/integration-sdk-js) and the
  official JavaScript template.

## License

[Apache 2.0](LICENSE).
