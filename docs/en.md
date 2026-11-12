# USGS Volcanoes

Follow the alert levels of the volcanoes of the United States from Gladys: Hawaii, Alaska, the Cascades,
California, Yellowstone, the Northern Mariana Islands and American Samoa. The five volcano observatories
of the [USGS](https://www.usgs.gov/programs/VHP) (United States Geological Survey) rate each monitored
volcano twice:

- the **Volcano Alert Level**, for the people on the ground: Normal, Advisory, Watch, Warning;
- the **Aviation Color Code**, for the planes: Green, Yellow, Orange, Red.

The integration reads them from [HANS](https://volcanoes.usgs.gov/hans-public/), the public notification
system of the USGS. No account, no API key.

This is a complement, not a safety alert system: in an emergency, follow the official notices and the
instructions of your local authorities. Not affiliated with the USGS.

## What you get

- One **device per followed volcano**: alert level, aviation color code, and the newest USGS notice (type,
  date and, for the most active volcanoes, a one-line synopsis), with their history.
- A **Nearby volcanoes** device: the highest alert level of the monitored volcanoes within a radius of
  your house, the number above normal, and the volcano concerned.
- A **dashboard widget** listing your volcanoes, most active first, each with its notice and its USGS page.
- A **scene trigger** when the alert level or the color code of a followed or nearby volcano changes.
- A **scene action** that reads the levels as one sentence, to send by message or have it read aloud.

## Requirements

- Gladys Assistant 5.3 or later.
- Internet access from the Gladys host (the integration reads `volcanoes.usgs.gov`).
- For the nearby volcanoes: a location for your house in Gladys (Settings → Houses), or coordinates typed
  in the configuration.

## Configuration

Install the integration from the store (or Integrations → Install from GitHub, with the address
`https://github.com/guim31/gladys-usgs-volcanoes`), then open its Configuration tab.

### Settings

| Setting                  | Default    | Effect                                                                       |
| ------------------------ | ---------- | ---------------------------------------------------------------------------- |
| Followed volcanoes       | empty      | Names, volcano numbers or observatory codes, separated by commas             |
| Nearby volcanoes: radius | 200 km     | Off, 50, 100, 200, 500 or 1,000 km around the centre                         |
| Centre latitude          | empty      | Leave both coordinates empty to use the location of your house               |
| Centre longitude         | empty      | Decimal degrees, west negative (`-121.7603`)                                 |
| Refresh interval         | 15 minutes | 10, 15, 30 or 60 minutes                                                     |
| Language of the texts    | French     | Names of the devices and features (at creation) and texts sent to the scenes |

Save, then open the Discovery tab: one device per followed volcano, plus **Nearby volcanoes** when a radius
is set. Add the ones you want to Gladys.

### Choosing volcanoes

Type the names as the USGS writes them, separated by commas. Case, accents and "Mount"/"Mt" do not
matter: `kilauea`, `Kīlauea`, `St. Helens` and `mt rainier` all work, and so does a part of one name only
(`shasta`). A part shared by several volcanoes (`sitkin`: Great Sitkin and Little Sitkin) is ambiguous and
ignored. You can also type the Smithsonian volcano number (`332010`) or an observatory code to follow all
its volcanoes. The Configuration tab lists the names it did not find.

The monitored volcanoes on 12/11/2026, by observatory:

- `avo`, Alaska Volcano Observatory: Akutan, Aniakchak, Atka volcanic complex, Augustine, Cleveland,
  Dutton, Edgecumbe, Fisher, Gareloi, Great Sitkin, Griggs, Iliamna, Isanotski, Kanaga, Katmai, Korovin,
  Little Sitkin, Mageik, Makushin, Martin, Novarupta, Okmok, Pavlof, Redoubt, Semisopochnoi, Shishaldin,
  Snowy Mountain, Spurr, Takawangha, Tanaga, Trident, Ugashik-Peulik, Ukinrek Maars, Veniaminof, Westdahl,
  Wrangell.
- `calvo`, California Volcano Observatory: Clear Lake Volcanic Field, Coso Volcanic Field, Lassen Volcanic
  Center, Long Valley Caldera, Mammoth Mountain, Medicine Lake volcano, Mono Lake Volcanic Field,
  Mono-Inyo Craters, Mount Shasta, Salton Buttes, Ubehebe Craters.
- `cvo`, Cascades Volcano Observatory: Crater Lake, Glacier Peak, Mount Adams, Mount Baker, Mount Hood,
  Mount Jefferson, Mount Rainier, Mount St. Helens, Newberry, Three Sisters.
- `hvo`, Hawaiian Volcano Observatory: Haleakala, Hualalai, Kilauea, Mauna Kea, Mauna Loa, and in American
  Samoa Ofu-Olosega, Ta'u Island, Tutuila Island.
- `nmi`, Northern Mariana Islands: Ahyi Seamount.
- `yvo`, Yellowstone Volcano Observatory: Yellowstone.

The other US volcanoes have no alert level (not monitored in real time): they cannot be followed.

## Devices

Each followed volcano is a device named after it ("Volcano Kilauea"):

| Feature             | Values                                                |
| ------------------- | ----------------------------------------------------- |
| Volcano alert level | 0 Normal, 1 Advisory, 2 Watch, 3 Warning (risk level) |
| Aviation color code | 0 Green, 1 Yellow, 2 Orange, 3 Red (risk level)       |
| Latest USGS notice  | "Daily update, 11/11/2026: …" — type, date, synopsis  |

**Nearby volcanoes** sums up the monitored volcanoes within the radius:

| Feature                | Values                                            |
| ---------------------- | ------------------------------------------------- |
| Highest alert level    | 0 to 3, as above                                  |
| Volcanoes above normal | number of volcanoes above Normal or Green         |
| Most active volcano    | "Mount Rainier: Watch / Orange, 94 km", or "none" |

The alert levels have a numeric value: a scene condition such as "alert level greater than or equal to 2"
reacts to Watch and Warning, the cases the USGS describes as an eruption likely or under way. The history
of the alert level feature gives the date of each change.

## Dashboard widget

Add the **USGS volcanoes** widget to a dashboard: the number of volcanoes above normal, then your followed
volcanoes and the nearby ones above normal (8 at most), most active first. Each row shows the aviation color
code, the observatory and the distance; tap it for the newest notice, its synopsis, the date of the last
level change (once the integration has seen one), and the links to the notice and to the volcano page.

Two settings: **Only volcanoes above normal** hides the quiet ones, **Link to USGS HANS** shows or hides the
button at the bottom.

## Scene triggers

**USGS volcano: alert level changed** fires when the alert level or the aviation color code of a followed
volcano, or of a volcano within the radius, changes. Filters, all optional: the new alert level, the new
aviation color, and the direction (raised or lowered).

Variables: `alert_level`, `aviation_color` and `direction` (stable English words), `volcano`, `vnum`,
`observatory`, `alert_level_name` and `aviation_color_name` (in the language of the configuration),
`previous_alert_level`, `previous_aviation_color`, `distance_km` (empty without a centre), `summary`
("Kilauea: Watch / Orange, 4,317 km") and `notice_url`.

The levels already there at the first start fire nothing, and neither does a volcano you start to follow:
only the changes seen by the integration count. The last levels are kept: a change that happens while the integration is stopped fires at the next start, nothing else does.

## Scene action

**USGS volcanoes: read the levels** reads HANS again if needed and returns:

- `text`: one sentence, for example "1 volcano above normal: Kilauea: Advisory / Yellow; Mount Rainier:
  Normal / Green, 94 km." (5 volcanoes at most, then "and N more");
- `max_level`: `none`, `normal`, `advisory`, `watch` or `warning`;
- `elevated_count`: the number of volcanoes above normal.

The **Show the current levels** button of the Configuration tab gives the same sentence.

## Scene examples

- Get a message when a nearby volcano goes to Watch or Warning: trigger "USGS volcano: alert level
  changed", filters "Watch, Warning" and "raised", then send the `summary` and the `notice_url`.
- Every morning, read the levels aloud: scheduled trigger, action "USGS volcanoes: read the levels", then
  say `text`.
- Light a lamp in orange while Mount Rainier is above normal: condition on its alert level device.

## Data sources, terms and quotas

The data come from the Volcano Hazards Program of the USGS, through the public HANS API
(`https://volcanoes.usgs.gov/hans-public/api/`): the monitored volcanoes and their levels at each refresh,
the synopses of the most active ones (CAP alerts), and the positions of the US volcanoes once a day. USGS
data are in the public domain; the integration cites the source in the widget. HANS publishes no quota: the
integration asks three small documents per refresh at most, every 15 minutes by default.

Read the [alert levels explained by the USGS](https://www.usgs.gov/programs/VHP/about-alert-levels).

## Troubleshooting

- **"Not found among the monitored volcanoes, or ambiguous"**: check the spelling in the list above, or
  type the volcano number. A volcano that is not monitored in real time has no level.
- **"No centre for the nearby volcanoes"**: give your house a location in Gladys, or type coordinates.
- **"The USGS (HANS) does not answer"**: the values stay as they were; the integration tries again at the
  next refresh. Check the Internet access of the Gladys host.
- **No new device after a change of the list**: open the Discovery tab and add it.
- Run the container with `LOG_LEVEL=debug` to see each refresh in its logs.

## Limits

- United States volcanoes monitored by the USGS only; the levels are those of the newest notice.
- The date of the last level change is known only from the integration's own observation (HANS does not
  give it); the history of the feature in Gladys keeps it.
- The notices and synopses are in English, as the USGS writes them.
- The name of a device and of its features is fixed at its creation, in the language chosen then.
