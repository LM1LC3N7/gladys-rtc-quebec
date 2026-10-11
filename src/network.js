// -----------------------------------------------------------------------------
// The transit network this integration serves: RTC, Québec City.
//
// Everything that names the operator, its feeds or its lines lives here, so
// the rest of the code reads "the network", "the bike share", "the lines" —
// and the sister integrations (STM, TransLink, OC Transpo) differ from this one
// by this file, their gtfs/ folder and their texts, not by their logic.
// -----------------------------------------------------------------------------

export const NETWORK = {
  /** The operator, as riders call it. */
  operator: 'RTC',
  /** The device names start with it: "RTC – Chauveau / du Point-du-Jour". */
  stopPrefix: 'RTC – ',
  /** The language of the texts when the user did not choose one. */
  defaultLanguage: 'fr',

  /**
   * The static GTFS the stop table (gtfs/stops.json, gtfs/routes.json) is
   * generated from, by `npm run update-stops`.
   */
  gtfs: {
    url: 'https://cdn.rtcquebec.ca/Site_Internet/DonneesOuvertes/googletransit.zip',
    // The RTC stop name repeats the code ("Champlain/1005"); the description
    // names the corner, as the sign does: "Rue Champlain / boul. Champlain".
    stopName: (row) => row.stop_desc || row.stop_name,
  },

  /** Transitous ids are the GTFS ids behind this prefix: `ca-qc-RTC_1-1022`. */
  transitousPrefix: 'ca-qc-RTC_',

  /**
   * The RTC publishes no real-time feed in the open (its real time stays in
   * the Nomade app): the departures come from Transitous, without any key.
   */
  realtime: null,

  /** No line status device: there is no alerts feed either. */
  lines: [],
  linesName: { en: 'Métrobus', fr: 'Métrobus' },

  /** The bike share, read from its open GBFS feed (the same system as BIXI). */
  bike: {
    name: 'àVélo',
    prefix: 'àVélo – ',
    gbfsUrl: 'https://quebec.publicbikesystem.net/customer/gbfs/v2/gbfs.json',
  },

  /** The search example of the "Find a stop" answers: a network landmark. */
  examples: { search: 'Gare du Palais' },
};
