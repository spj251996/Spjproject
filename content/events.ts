import type { WeddingEvent } from "./types.ts";
import { validateEvents } from "./validate.ts";

export const events: WeddingEvent[] = validateEvents([
  {
    id: "engagement",
    state: "Kerala",
    date: "2027-01-04",
    segments: [
      {
        id: "engagement-church",
        label: "Betrothal",
        time: "10:30 AM",
        venue: "St. Antony's Syro-Malabar Church",
        address: "Paroppadi, Kozhikode, Kerala",
        mapUrl: "https://maps.app.goo.gl/zgM9uq5vf8B5RD7Q9",
      },
      {
        id: "engagement-reception",
        label: "Reception",
        time: "12:30 PM",
        venue: "St. Antony's Church Parish Hall",
        address: "Paroppadi, Kozhikode, Kerala",
        mapUrl: "https://maps.app.goo.gl/zGrd6SAFTZk3gAEx9",
      },
    ],
  },
  {
    id: "wedding",
    state: "Kerala",
    date: "2027-01-09",
    segments: [
      {
        id: "wedding-church",
        label: "Wedding",
        time: "10:30 AM",
        venue: "St. John the Baptist Catholic Church, Vadakara",
        address: "Koothattukulam, Ernakulam, Kerala",
        mapUrl: "https://maps.app.goo.gl/Js7xUDTPfWqoeTc18",
      },
      {
        id: "wedding-reception",
        label: "Reception",
        time: "12:30 PM",
        venue: "Thuvampallil Convention Centre",
        address: "Koothattukulam, Ernakulam, Kerala",
        mapUrl: "https://maps.app.goo.gl/uHGeZVh5jYNtpMZC9",
      },
    ],
  },
]);
