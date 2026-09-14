/**
 * Team members across the four demo tenants.
 *
 * `isBookable` marks the people who can be assigned to a departure on the
 * dispatch board — captains, guides and instructors — as opposed to office
 * staff and the external bookkeeper.
 *
 * `lastActiveAt` is written without a UTC suffix on purpose: parsed in local
 * time it keeps its distance from NOW identical in every runtime timezone, so
 * "active 12 minutes ago" renders the same everywhere.
 */

import type { User } from '@/types'
import { avatarUrl } from './constants'

export const USERS: User[] = [
  /* ---------------------------------------------------------------------
     Blue Horizon Watersports — Maui, HI (primary demo tenant)
     --------------------------------------------------------------------- */
  {
    id: 'usr_kaimana_reyes',
    tenantId: 'tnt_bluehorizon',
    name: 'Kaimana Reyes',
    email: 'kaimana@bluehorizonmaui.com',
    role: 'owner',
    avatarUrl: avatarUrl(12),
    title: 'Founder & Managing Director',
    phone: '+1 (808) 555-0101',
    status: 'active',
    lastActiveAt: '2026-09-11T08:52:00',
    isBookable: false,
    certifications: ['USCG Master 100-Ton', 'PADI Rescue Diver'],
  },
  {
    id: 'usr_marisol_vega',
    tenantId: 'tnt_bluehorizon',
    name: 'Marisol Vega',
    email: 'marisol@bluehorizonmaui.com',
    role: 'admin',
    avatarUrl: avatarUrl(5),
    title: 'Director of Operations',
    phone: '+1 (808) 555-0102',
    status: 'active',
    lastActiveAt: '2026-09-11T08:47:00',
    isBookable: false,
  },
  {
    id: 'usr_tane_kahananui',
    tenantId: 'tnt_bluehorizon',
    name: 'Tane Kahananui',
    email: 'tane@bluehorizonmaui.com',
    role: 'manager',
    avatarUrl: avatarUrl(13),
    title: 'Head Captain',
    phone: '+1 (808) 555-0103',
    status: 'active',
    lastActiveAt: '2026-09-11T05:58:00',
    isBookable: true,
    certifications: [
      'USCG Master 100-Ton Near Coastal',
      'STCW Basic Safety Training',
      'Wilderness First Responder',
    ],
  },
  {
    id: 'usr_hallie_okafor',
    tenantId: 'tnt_bluehorizon',
    name: 'Hallie Okafor',
    email: 'hallie@bluehorizonmaui.com',
    role: 'manager',
    avatarUrl: avatarUrl(32),
    title: 'Reservations Lead',
    phone: '+1 (808) 555-0104',
    status: 'active',
    lastActiveAt: '2026-09-11T08:58:00',
    isBookable: false,
  },
  {
    id: 'usr_diego_santoro',
    tenantId: 'tnt_bluehorizon',
    name: 'Diego Santoro',
    email: 'diego@bluehorizonmaui.com',
    role: 'guide',
    avatarUrl: avatarUrl(15),
    title: 'PADI Divemaster',
    phone: '+1 (808) 555-0105',
    status: 'active',
    lastActiveAt: '2026-09-11T06:12:00',
    isBookable: true,
    certifications: ['PADI Divemaster #412887', 'DAN Oxygen Provider', 'EFR Instructor'],
  },
  {
    id: 'usr_leilani_kapahu',
    tenantId: 'tnt_bluehorizon',
    name: 'Leilani Kapahu',
    email: 'leilani@bluehorizonmaui.com',
    role: 'guide',
    avatarUrl: avatarUrl(44),
    title: 'Lead Snorkel Guide & Naturalist',
    phone: '+1 (808) 555-0106',
    status: 'active',
    lastActiveAt: '2026-09-11T07:31:00',
    isBookable: true,
    certifications: ['Lifeguard & CPR/AED', 'NOAA Marine Naturalist', 'Reef Etiquette Trainer'],
  },
  {
    id: 'usr_josh_brennan',
    tenantId: 'tnt_bluehorizon',
    name: 'Josh Brennan',
    email: 'josh@bluehorizonmaui.com',
    role: 'guide',
    avatarUrl: avatarUrl(33),
    title: 'Head Surf Instructor',
    phone: '+1 (808) 555-0107',
    status: 'active',
    lastActiveAt: '2026-09-11T07:05:00',
    isBookable: true,
    certifications: ['ISA Level 2 Surf Coach', 'Surf Lifesaving Award', 'CPR/AED'],
  },
  {
    id: 'usr_noelani_akana',
    tenantId: 'tnt_bluehorizon',
    name: 'Noelani Akana',
    email: 'noelani@bluehorizonmaui.com',
    role: 'guide',
    avatarUrl: avatarUrl(27),
    title: 'Marine Naturalist & Whale Guide',
    phone: '+1 (808) 555-0108',
    status: 'active',
    lastActiveAt: '2026-09-10T16:44:00',
    isBookable: true,
    certifications: ['Hawaiian Islands Humpback Sanctuary Naturalist', 'Small Boat Operator'],
  },
  {
    id: 'usr_priya_raghunathan',
    tenantId: 'tnt_bluehorizon',
    name: 'Priya Raghunathan',
    email: 'priya@bluehorizonmaui.com',
    role: 'staff',
    avatarUrl: avatarUrl(48),
    title: 'Guest Experience Specialist',
    phone: '+1 (808) 555-0109',
    status: 'active',
    lastActiveAt: '2026-09-11T08:41:00',
    isBookable: false,
  },
  {
    id: 'usr_sam_whitfield',
    tenantId: 'tnt_bluehorizon',
    name: 'Sam Whitfield',
    email: 'sam@bluehorizonmaui.com',
    role: 'staff',
    avatarUrl: avatarUrl(51),
    title: 'Dock Supervisor',
    phone: '+1 (808) 555-0110',
    status: 'active',
    lastActiveAt: '2026-09-11T06:35:00',
    isBookable: true,
    certifications: ['Forklift & Hoist Operator', 'CPR/AED'],
  },
  {
    id: 'usr_ana_ferreira',
    tenantId: 'tnt_bluehorizon',
    name: 'Ana Ferreira',
    email: 'ana@bluehorizonmaui.com',
    role: 'staff',
    avatarUrl: avatarUrl(47),
    title: 'Retail & Rentals Coordinator',
    phone: '+1 (808) 555-0111',
    status: 'invited',
    lastActiveAt: '2026-09-08T15:20:00',
    isBookable: false,
  },
  {
    id: 'usr_gavin_mercer',
    tenantId: 'tnt_bluehorizon',
    name: 'Gavin Mercer',
    email: 'gavin@mercerbookkeeping.com',
    role: 'viewer',
    avatarUrl: avatarUrl(60),
    title: 'Bookkeeper (external)',
    status: 'active',
    lastActiveAt: '2026-09-09T11:02:00',
    isBookable: false,
  },

  /* ---------------------------------------------------------------------
     Coral Cay Expeditions — Port Douglas, QLD
     --------------------------------------------------------------------- */
  {
    id: 'usr_isla_fairweather',
    tenantId: 'tnt_coralcay',
    name: 'Isla Fairweather',
    email: 'isla@coralcayexpeditions.com.au',
    role: 'owner',
    avatarUrl: avatarUrl(26),
    title: 'Founder & Expedition Director',
    phone: '+61 400 118 204',
    status: 'active',
    lastActiveAt: '2026-09-11T07:18:00',
    isBookable: false,
    certifications: ['AMSA Master <24m', 'PADI Instructor #268114'],
  },
  {
    id: 'usr_daniel_wirrpanda',
    tenantId: 'tnt_coralcay',
    name: 'Daniel Wirrpanda',
    email: 'daniel@coralcayexpeditions.com.au',
    role: 'manager',
    avatarUrl: avatarUrl(52),
    title: 'Skipper & Reef Operations Manager',
    phone: '+61 400 118 219',
    status: 'active',
    lastActiveAt: '2026-09-11T06:02:00',
    isBookable: true,
    certifications: ['AMSA Coxswain Grade 1', 'Marine Radio Operator (MROCP)', 'Senior First Aid'],
  },
  {
    id: 'usr_mei_lin_chow',
    tenantId: 'tnt_coralcay',
    name: 'Mei-Lin Chow',
    email: 'meilin@coralcayexpeditions.com.au',
    role: 'guide',
    avatarUrl: avatarUrl(20),
    title: 'Marine Biologist & Dive Instructor',
    phone: '+61 400 118 233',
    status: 'active',
    lastActiveAt: '2026-09-10T18:26:00',
    isBookable: true,
    certifications: [
      'PADI Master Scuba Diver Trainer',
      'Reef Check Australia Surveyor',
      'Coral Bleaching Response Certified',
    ],
  },
  {
    id: 'usr_oscar_bennett',
    tenantId: 'tnt_coralcay',
    name: 'Oscar Bennett',
    email: 'oscar@coralcayexpeditions.com.au',
    role: 'staff',
    avatarUrl: avatarUrl(53),
    title: 'Reservations & Charters',
    phone: '+61 400 118 247',
    status: 'active',
    lastActiveAt: '2026-09-11T08:04:00',
    isBookable: false,
  },

  /* ---------------------------------------------------------------------
     Saltline Kitchen & Terrace — Oia, Santorini
     --------------------------------------------------------------------- */
  {
    id: 'usr_dimitra_stavrou',
    tenantId: 'tnt_saltline',
    name: 'Dimitra Stavrou',
    email: 'dimitra@saltline.gr',
    role: 'owner',
    avatarUrl: avatarUrl(45),
    title: 'Chef-Owner',
    phone: '+30 694 552 0118',
    status: 'active',
    lastActiveAt: '2026-09-11T07:49:00',
    isBookable: false,
  },
  {
    id: 'usr_yiannis_petrou',
    tenantId: 'tnt_saltline',
    name: 'Yiannis Petrou',
    email: 'yiannis@saltline.gr',
    role: 'manager',
    avatarUrl: avatarUrl(54),
    title: 'Maître d’hôtel',
    phone: '+30 694 552 0126',
    status: 'active',
    lastActiveAt: '2026-09-11T08:22:00',
    isBookable: true,
  },
  {
    id: 'usr_elena_marinos',
    tenantId: 'tnt_saltline',
    name: 'Elena Marinos',
    email: 'elena@saltline.gr',
    role: 'staff',
    avatarUrl: avatarUrl(49),
    title: 'Reservations Host',
    phone: '+30 694 552 0139',
    status: 'active',
    lastActiveAt: '2026-09-11T08:36:00',
    isBookable: false,
  },

  /* ---------------------------------------------------------------------
     Ridgeline Adventure Co. — Queenstown, NZ
     --------------------------------------------------------------------- */
  {
    id: 'usr_hana_whitcombe',
    tenantId: 'tnt_ridgeline',
    name: 'Hana Whitcombe',
    email: 'hana@ridgelineadventure.co.nz',
    role: 'owner',
    avatarUrl: avatarUrl(25),
    title: 'Managing Director',
    phone: '+64 21 448 0912',
    status: 'active',
    lastActiveAt: '2026-09-11T08:15:00',
    isBookable: false,
  },
  {
    id: 'usr_rory_mcallister',
    tenantId: 'tnt_ridgeline',
    name: 'Rory McAllister',
    email: 'rory@ridgelineadventure.co.nz',
    role: 'admin',
    avatarUrl: avatarUrl(56),
    title: 'Head of Guiding',
    phone: '+64 21 448 0927',
    status: 'active',
    lastActiveAt: '2026-09-11T06:41:00',
    isBookable: true,
    certifications: ['NZOIA Alpine 2', 'Avalanche Risk Management 2', 'Pre-Hospital Emergency Care'],
  },
  {
    id: 'usr_tui_ngata',
    tenantId: 'tnt_ridgeline',
    name: 'Tui Ngata',
    email: 'tui@ridgelineadventure.co.nz',
    role: 'guide',
    avatarUrl: avatarUrl(57),
    title: 'IFMGA Mountain Guide',
    phone: '+64 21 448 0934',
    status: 'active',
    lastActiveAt: '2026-09-10T19:08:00',
    isBookable: true,
    certifications: ['IFMGA/NZMGA Mountain Guide', 'Glacier Rescue Instructor', 'WFR'],
  },
  {
    id: 'usr_bridget_lowry',
    tenantId: 'tnt_ridgeline',
    name: 'Bridget Lowry',
    email: 'bridget@ridgelineadventure.co.nz',
    role: 'manager',
    avatarUrl: avatarUrl(41),
    title: 'Fleet & Aviation Coordinator',
    phone: '+64 21 448 0946',
    status: 'active',
    lastActiveAt: '2026-09-11T07:57:00',
    isBookable: false,
    certifications: ['CAA Part 135 Ground Ops', 'Dangerous Goods Handling'],
  },
]

export function getUsersByTenant(tenantId: string): User[] {
  return USERS.filter((user) => user.tenantId === tenantId)
}

export function getUserById(id: string): User | undefined {
  return USERS.find((user) => user.id === id)
}

/** Staff assignable to a departure — powers the dispatch board pickers. */
export function getBookableStaff(tenantId: string): User[] {
  return USERS.filter((user) => user.tenantId === tenantId && user.isBookable && user.status === 'active')
}

/** Kaimana Reyes — the Blue Horizon owner the demo is signed in as. */
export const CURRENT_USER: User =
  USERS.find((user) => user.id === 'usr_kaimana_reyes') ?? USERS[0]
