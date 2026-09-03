/**
* This file was @generated using pocketbase-typegen
*/

import type PocketBase from 'pocketbase'
import type { RecordService } from 'pocketbase'

export const Collections = {
	Authorigins: "_authOrigins",
	Externalauths: "_externalAuths",
	Mfas: "_mfas",
	Otps: "_otps",
	Superusers: "_superusers",
	Activities: "activities",
	Blocks: "blocks",
	Costs: "costs",
	Days: "days",
	Invites: "invites",
	Legs: "legs",
	Pois: "pois",
	RouteCache: "route_cache",
	Stops: "stops",
	TripMembers: "trip_members",
	Trips: "trips",
	Users: "users",
} as const
export type Collections = typeof Collections[keyof typeof Collections]

// Alias types for improved usability
export type IsoDateString = string
export type IsoAutoDateString = string & { readonly autodate: unique symbol }
export type RecordIdString = string
export type FileNameString = string & { readonly filename: unique symbol }
export type HTMLString = string

type ExpandType<T> = unknown extends T
	? T extends unknown
		? { expand?: unknown }
		: { expand: T }
	: { expand: T }

// System fields
export type BaseSystemFields<T = unknown> = {
	id: RecordIdString
	collectionId: string
	collectionName: Collections
} & ExpandType<T>

export type AuthSystemFields<T = unknown> = {
	email: string
	emailVisibility: boolean
	username: string
	verified: boolean
} & BaseSystemFields<T>

// Record types for each collection

export type AuthoriginsRecord = {
	collectionRef: string
	created: IsoAutoDateString
	fingerprint: string
	id: string
	recordRef: string
	updated: IsoAutoDateString
}

export type ExternalauthsRecord = {
	collectionRef: string
	created: IsoAutoDateString
	id: string
	provider: string
	providerId: string
	recordRef: string
	updated: IsoAutoDateString
}

export type MfasRecord = {
	collectionRef: string
	created: IsoAutoDateString
	id: string
	method: string
	recordRef: string
	updated: IsoAutoDateString
}

export type OtpsRecord = {
	collectionRef: string
	created: IsoAutoDateString
	id: string
	password: string
	recordRef: string
	sentTo?: string
	updated: IsoAutoDateString
}

export type SuperusersRecord = {
	created: IsoAutoDateString
	email: string
	emailVisibility?: boolean
	id: string
	password: string
	tokenKey: string
	updated: IsoAutoDateString
	verified?: boolean
}

export const ActivitiesKindOptions = {
	"activity": "activity",
	"break": "break",
} as const
export type ActivitiesKindOptions = typeof ActivitiesKindOptions[keyof typeof ActivitiesKindOptions]
export type ActivitiesRecord = {
	created: IsoAutoDateString
	duration_min: number
	id: string
	kind: ActivitiesKindOptions
	notes?: string
	order_index?: number
	stop: RecordIdString
	title: string
	updated: IsoAutoDateString
}

export const BlocksParentTypeOptions = {
	"trip": "trip",
	"day": "day",
	"stop": "stop",
	"leg": "leg",
	"poi": "poi",
} as const
export type BlocksParentTypeOptions = typeof BlocksParentTypeOptions[keyof typeof BlocksParentTypeOptions]

export const BlocksKindOptions = {
	"note": "note",
	"link": "link",
	"photo": "photo",
	"file": "file",
} as const
export type BlocksKindOptions = typeof BlocksKindOptions[keyof typeof BlocksKindOptions]

export const BlocksVisibilityOptions = {
	"private": "private",
	"trip": "trip",
	"public": "public",
} as const
export type BlocksVisibilityOptions = typeof BlocksVisibilityOptions[keyof typeof BlocksVisibilityOptions]
export type BlocksRecord = {
	attribution_author?: string
	attribution_licence?: string
	attribution_url?: string
	body?: string
	created: IsoAutoDateString
	creator: RecordIdString
	file?: FileNameString
	id: string
	kind: BlocksKindOptions
	lat?: number
	lon?: number
	order_index?: number
	parent_id: string
	parent_type: BlocksParentTypeOptions
	taken_at?: IsoDateString
	title?: string
	trip: RecordIdString
	updated: IsoAutoDateString
	url?: string
	visibility: BlocksVisibilityOptions
}

export const CostsParentTypeOptions = {
	"trip": "trip",
	"day": "day",
	"stop": "stop",
	"leg": "leg",
	"poi": "poi",
} as const
export type CostsParentTypeOptions = typeof CostsParentTypeOptions[keyof typeof CostsParentTypeOptions]
export type CostsRecord = {
	amount: number
	category?: string
	created: IsoAutoDateString
	currency: string
	id: string
	is_estimate?: boolean
	label?: string
	parent_id?: string
	parent_type?: CostsParentTypeOptions
	trip: RecordIdString
	updated: IsoAutoDateString
}

export const DaysKindOptions = {
	"travel": "travel",
	"rest": "rest",
} as const
export type DaysKindOptions = typeof DaysKindOptions[keyof typeof DaysKindOptions]
export type DaysRecord = {
	created: IsoAutoDateString
	id: string
	kind: DaysKindOptions
	notes?: string
	order_index?: number
	start_stop?: RecordIdString
	title?: string
	trip: RecordIdString
	updated: IsoAutoDateString
}

export const InvitesRoleOptions = {
	"owner": "owner",
	"editor": "editor",
	"viewer": "viewer",
} as const
export type InvitesRoleOptions = typeof InvitesRoleOptions[keyof typeof InvitesRoleOptions]

export const InvitesStatusOptions = {
	"pending": "pending",
	"accepted": "accepted",
	"revoked": "revoked",
} as const
export type InvitesStatusOptions = typeof InvitesStatusOptions[keyof typeof InvitesStatusOptions]
export type InvitesRecord = {
	created: IsoAutoDateString
	email: string
	id: string
	invited_by: RecordIdString
	role: InvitesRoleOptions
	status: InvitesStatusOptions
	trip: RecordIdString
	updated: IsoAutoDateString
}

export const LegsModeOptions = {
	"car": "car",
	"walk": "walk",
	"flight": "flight",
	"ferry": "ferry",
	"bike": "bike",
	"other": "other",
} as const
export type LegsModeOptions = typeof LegsModeOptions[keyof typeof LegsModeOptions]

export const LegsSurfaceOptions = {
	"paved": "paved",
	"gravel": "gravel",
	"froad": "froad",
} as const
export type LegsSurfaceOptions = typeof LegsSurfaceOptions[keyof typeof LegsSurfaceOptions]

export const LegsRoutingSourceOptions = {
	"ors": "ors",
	"manual": "manual",
} as const
export type LegsRoutingSourceOptions = typeof LegsRoutingSourceOptions[keyof typeof LegsRoutingSourceOptions]
export type LegsRecord<Tgeometry = unknown> = {
	buffer_override_pct?: number
	created: IsoAutoDateString
	distance_m?: number
	duration_min?: number
	from_stop: RecordIdString
	geometry?: null | Tgeometry
	id: string
	mode: LegsModeOptions
	routing_source?: LegsRoutingSourceOptions
	seasonal_warning?: boolean
	surface?: LegsSurfaceOptions
	to_stop: RecordIdString
	updated: IsoAutoDateString
}

export const PoisKindOptions = {
	"waterfall": "waterfall",
	"canyon": "canyon",
	"glacier": "glacier",
	"hot_spring": "hot_spring",
	"volcano": "volcano",
	"cave": "cave",
	"lake": "lake",
	"coast": "coast",
	"viewpoint": "viewpoint",
	"hike": "hike",
	"museum": "museum",
	"monument": "monument",
	"church": "church",
	"town": "town",
	"restaurant": "restaurant",
	"hotel": "hotel",
	"campsite": "campsite",
	"airport": "airport",
	"ferry": "ferry",
	"fuel": "fuel",
	"shop": "shop",
	"pool": "pool",
	"wildlife": "wildlife",
	"parking": "parking",
	"other": "other",
	"uncategorized": "uncategorized",
	"rental": "rental",
} as const
export type PoisKindOptions = typeof PoisKindOptions[keyof typeof PoisKindOptions]
export type PoisRecord = {
	access_lat?: number
	access_lon?: number
	address?: string
	created: IsoAutoDateString
	creator?: RecordIdString
	creator_color?: string
	creator_name?: string
	id: string
	kind?: PoisKindOptions
	lat?: number
	lon?: number
	starred?: boolean
	title: string
	trip: RecordIdString
	updated: IsoAutoDateString
}

export type RouteCacheRecord<Tgeometry = unknown> = {
	created: IsoAutoDateString
	distance_m?: number
	duration_min?: number
	geometry?: null | Tgeometry
	id: string
	key: string
}

export const StopsKindOptions = {
	"waterfall": "waterfall",
	"canyon": "canyon",
	"glacier": "glacier",
	"hot_spring": "hot_spring",
	"volcano": "volcano",
	"cave": "cave",
	"lake": "lake",
	"coast": "coast",
	"viewpoint": "viewpoint",
	"hike": "hike",
	"museum": "museum",
	"monument": "monument",
	"church": "church",
	"town": "town",
	"restaurant": "restaurant",
	"hotel": "hotel",
	"campsite": "campsite",
	"airport": "airport",
	"ferry": "ferry",
	"fuel": "fuel",
	"shop": "shop",
	"pool": "pool",
	"wildlife": "wildlife",
	"parking": "parking",
	"other": "other",
	"uncategorized": "uncategorized",
	"rental": "rental",
} as const
export type StopsKindOptions = typeof StopsKindOptions[keyof typeof StopsKindOptions]

export const StopsAnchorTypeOptions = {
	"arrival": "arrival",
	"departure": "departure",
} as const
export type StopsAnchorTypeOptions = typeof StopsAnchorTypeOptions[keyof typeof StopsAnchorTypeOptions]

export const StopsRoutingKindOptions = {
	"stop": "stop",
	"waypoint": "waypoint",
} as const
export type StopsRoutingKindOptions = typeof StopsRoutingKindOptions[keyof typeof StopsRoutingKindOptions]
export type StopsRecord = {
	access_lat?: number
	access_lon?: number
	address?: string
	anchor_time?: string
	anchor_type?: StopsAnchorTypeOptions
	created: IsoAutoDateString
	day: RecordIdString
	dwell_override?: number
	id: string
	is_accommodation?: boolean
	kind: StopsKindOptions
	kind_confirmed?: boolean
	lat?: number
	lon?: number
	order_index?: number
	routing_kind?: StopsRoutingKindOptions
	starred?: boolean
	title: string
	updated: IsoAutoDateString
}

export const TripMembersRoleOptions = {
	"owner": "owner",
	"editor": "editor",
	"viewer": "viewer",
} as const
export type TripMembersRoleOptions = typeof TripMembersRoleOptions[keyof typeof TripMembersRoleOptions]
export type TripMembersRecord = {
	created: IsoAutoDateString
	id: string
	label?: string
	role: TripMembersRoleOptions
	trip: RecordIdString
	updated: IsoAutoDateString
	user: RecordIdString
}

export type TripsRecord<Tdefault_dwell = unknown, Tsurface_multipliers = unknown> = {
	car_buffer_pct?: number
	created: IsoAutoDateString
	currency: string
	default_dwell: null | Tdefault_dwell
	id: string
	owner: RecordIdString
	share_enabled?: boolean
	share_token?: string
	start_date: IsoDateString
	surface_multipliers: null | Tsurface_multipliers
	timezone: string
	title: string
	updated: IsoAutoDateString
}

export type UsersRecord<Trouting_keys = unknown, Trouting_providers = unknown> = {
	avatar?: FileNameString
	color?: string
	created: IsoAutoDateString
	email: string
	emailVisibility?: boolean
	id: string
	link_out?: string
	name?: string
	password: string
	routing_backend?: string
	routing_keys?: null | Trouting_keys
	routing_providers?: null | Trouting_providers
	tokenKey: string
	updated: IsoAutoDateString
	verified?: boolean
}

// Response types include system fields and match responses from the PocketBase API
export type AuthoriginsResponse<Texpand = unknown> = Required<AuthoriginsRecord> & BaseSystemFields<Texpand>
export type ExternalauthsResponse<Texpand = unknown> = Required<ExternalauthsRecord> & BaseSystemFields<Texpand>
export type MfasResponse<Texpand = unknown> = Required<MfasRecord> & BaseSystemFields<Texpand>
export type OtpsResponse<Texpand = unknown> = Required<OtpsRecord> & BaseSystemFields<Texpand>
export type SuperusersResponse<Texpand = unknown> = Required<SuperusersRecord> & AuthSystemFields<Texpand>
export type ActivitiesResponse<Texpand = unknown> = Required<ActivitiesRecord> & BaseSystemFields<Texpand>
export type BlocksResponse<Texpand = unknown> = Required<BlocksRecord> & BaseSystemFields<Texpand>
export type CostsResponse<Texpand = unknown> = Required<CostsRecord> & BaseSystemFields<Texpand>
export type DaysResponse<Texpand = unknown> = Required<DaysRecord> & BaseSystemFields<Texpand>
export type InvitesResponse<Texpand = unknown> = Required<InvitesRecord> & BaseSystemFields<Texpand>
export type LegsResponse<Tgeometry = unknown, Texpand = unknown> = Required<LegsRecord<Tgeometry>> & BaseSystemFields<Texpand>
export type PoisResponse<Texpand = unknown> = Required<PoisRecord> & BaseSystemFields<Texpand>
export type RouteCacheResponse<Tgeometry = unknown, Texpand = unknown> = Required<RouteCacheRecord<Tgeometry>> & BaseSystemFields<Texpand>
export type StopsResponse<Texpand = unknown> = Required<StopsRecord> & BaseSystemFields<Texpand>
export type TripMembersResponse<Texpand = unknown> = Required<TripMembersRecord> & BaseSystemFields<Texpand>
export type TripsResponse<Tdefault_dwell = unknown, Tsurface_multipliers = unknown, Texpand = unknown> = Required<TripsRecord<Tdefault_dwell, Tsurface_multipliers>> & BaseSystemFields<Texpand>
export type UsersResponse<Trouting_keys = unknown, Trouting_providers = unknown, Texpand = unknown> = Required<UsersRecord<Trouting_keys, Trouting_providers>> & AuthSystemFields<Texpand>

// Types containing all Records and Responses, useful for creating typing helper functions

export type CollectionRecords = {
	_authOrigins: AuthoriginsRecord
	_externalAuths: ExternalauthsRecord
	_mfas: MfasRecord
	_otps: OtpsRecord
	_superusers: SuperusersRecord
	activities: ActivitiesRecord
	blocks: BlocksRecord
	costs: CostsRecord
	days: DaysRecord
	invites: InvitesRecord
	legs: LegsRecord
	pois: PoisRecord
	route_cache: RouteCacheRecord
	stops: StopsRecord
	trip_members: TripMembersRecord
	trips: TripsRecord
	users: UsersRecord
}

export type CollectionResponses = {
	_authOrigins: AuthoriginsResponse
	_externalAuths: ExternalauthsResponse
	_mfas: MfasResponse
	_otps: OtpsResponse
	_superusers: SuperusersResponse
	activities: ActivitiesResponse
	blocks: BlocksResponse
	costs: CostsResponse
	days: DaysResponse
	invites: InvitesResponse
	legs: LegsResponse
	pois: PoisResponse
	route_cache: RouteCacheResponse
	stops: StopsResponse
	trip_members: TripMembersResponse
	trips: TripsResponse
	users: UsersResponse
}

// Utility types for create/update operations

type ProcessCreateAndUpdateFields<T> = Omit<{
	// Omit AutoDate fields
	[K in keyof T as Extract<T[K], IsoAutoDateString> extends never ? K : never]: 
		// Convert FileNameString to File
		T[K] extends infer U ? 
			U extends (FileNameString | FileNameString[]) ? 
				U extends any[] ? File[] : File 
			: U
		: never
}, 'id'>

// Create type for Auth collections
export type CreateAuth<T> = {
	id?: RecordIdString
	email: string
	emailVisibility?: boolean
	password: string
	passwordConfirm: string
	verified?: boolean
} & ProcessCreateAndUpdateFields<T>

// Create type for Base collections
export type CreateBase<T> = {
	id?: RecordIdString
} & ProcessCreateAndUpdateFields<T>

// Update type for Auth collections
export type UpdateAuth<T> = Partial<
	Omit<ProcessCreateAndUpdateFields<T>, keyof AuthSystemFields>
> & {
	email?: string
	emailVisibility?: boolean
	oldPassword?: string
	password?: string
	passwordConfirm?: string
	verified?: boolean
}

// Update type for Base collections
export type UpdateBase<T> = Partial<
	Omit<ProcessCreateAndUpdateFields<T>, keyof BaseSystemFields>
>

// Get the correct create type for any collection
export type Create<T extends keyof CollectionResponses> =
	CollectionResponses[T] extends AuthSystemFields
		? CreateAuth<CollectionRecords[T]>
		: CreateBase<CollectionRecords[T]>

// Get the correct update type for any collection
export type Update<T extends keyof CollectionResponses> =
	CollectionResponses[T] extends AuthSystemFields
		? UpdateAuth<CollectionRecords[T]>
		: UpdateBase<CollectionRecords[T]>

// Type for usage with type asserted PocketBase instance
// https://github.com/pocketbase/js-sdk#specify-typescript-definitions

export type TypedPocketBase = {
	collection<T extends keyof CollectionResponses>(
		idOrName: T
	): RecordService<CollectionResponses[T]>
} & PocketBase
