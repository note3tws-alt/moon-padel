/*
  Moon Padel site settings. This is the one file to edit for day-to-day updates.

  Rules:
  - Anything in [square brackets] shows on the site as a highlighted placeholder.
    Replace it with the real value once the founders confirm it.
  - Never put in a date, venue, fee, prize or number that is not confirmed.
*/
window.MOON = {
  // WhatsApp number in international format, digits only (country code first, no + or spaces).
  // Leave empty until confirmed: buttons then open WhatsApp with "MOON" ready and no number filled in.
  whatsappNumber: "",
  whatsappKeyword: "MOON",

  // Instagram handle without the @. Leave empty to hide the link.
  instagram: "",

  // Contact email for partners and corporate. Leave empty to hide.
  email: "",

  // Shows a thin bar at the top saying the site is a preview. Set to false at launch.
  showDraftBanner: true,

  // Transfer and waitlist windows used in the rules and FAQ.
  transferHours: "[X]",
  waitlistMinutes: "[X]",

  /*
    Events. One object per night, newest first or in date order.
    type:    "flagship" (Full Moon Night) or "night" (regular Moon Night)
    status:  "soon"  registration not open yet (button: get first access)
             "open"  registration open (button: register; uses payUrl if set, otherwise WhatsApp)
             "full"  sold out (button: join the free waitlist)
             "done"  finished (button: see results)
    levels:  any of "Crescent", "Half moon", "Gibbous", "Full moon"
  */
  events: [
    {
      id: "full-moon-night-01",
      type: "flagship",
      title: "Full Moon Night 01",
      date: "[DATE]",
      time: "[TIME]",
      venue: "[VENUE]",
      area: "Dubai",
      levels: ["Crescent", "Half moon", "Gibbous", "Full moon"],
      format: "[FORMAT]",
      fee: "AED [FEE]",
      capacity: "[CAPACITY]",
      taken: null,
      payUrl: "",
      status: "soon"
    },
    {
      id: "moon-night-01",
      type: "night",
      title: "Moon Night",
      date: "[DATE]",
      time: "[TIME]",
      venue: "[VENUE]",
      area: "Dubai",
      levels: ["[LEVELS]"],
      format: "[FORMAT]",
      fee: "AED [FEE]",
      capacity: "[CAPACITY]",
      taken: null,
      payUrl: "",
      status: "soon"
    }
  ],

  /*
    Season standings. Empty until the first night is played.
    Example row: { name: "Player name", level: "Gibbous", nights: 3, points: 412 }
  */
  standings: {
    players: [],
    pairs: []
  },

  /*
    Latest champions, one per level.
    Example: { level: "Gibbous", names: "Player A & Player B", event: "Full Moon Night 01", date: "[DATE]" }
  */
  champions: [],

  /*
    Monthly recognition. Example:
    { month: "[MONTH]", player: "Player name", pair: "Player A & Player B", note: "Unbeaten across three nights." }
  */
  ofTheMonth: null,

  // Venues once agreed. Example: { name: "Venue name", area: "Dubai area", mapUrl: "https://maps.google.com/?q=..." }
  venues: []
};
