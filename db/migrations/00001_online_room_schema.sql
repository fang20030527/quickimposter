create schema if not exists private;

revoke all privileges on schema private from public;

do $role$
begin
  if not exists (
    select 1
    from pg_catalog.pg_roles
    where rolname = 'quickimposter_app'
  ) then
    create role quickimposter_app nologin;
  else
    alter role quickimposter_app nologin;
  end if;
end
$role$;

revoke all privileges on schema private from quickimposter_app;
grant usage on schema private to quickimposter_app;

create table private.rooms (
  id text primary key,
  phase text not null default 'lobby',
  version integer not null default 0,
  category text not null,
  current_round_id uuid,
  host_player_id uuid,
  host_last_seen_at timestamptz not null default clock_timestamp(),
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp(),
  closed_at timestamptz,
  expires_at timestamptz not null,
  constraint rooms_id_format_check
    check (id ~ '^[A-Za-z0-9_-]{22}$'),
  constraint rooms_phase_check
    check (phase in (
      'lobby',
      'private-reveal',
      'discussion',
      'imposter-revealed',
      'civilian-revealed',
      'closed'
    )),
  constraint rooms_version_check check (version >= 0),
  constraint rooms_category_check
    check (category in (
      'All Categories',
      'Food',
      'Animals',
      'Objects',
      'Places',
      'Entertainment',
      'Sports',
      'Jobs',
      'Nature'
    )),
  constraint rooms_updated_at_check check (updated_at >= created_at),
  constraint rooms_closed_at_check
    check (closed_at is null or closed_at >= created_at),
  constraint rooms_expiry_check
    check (expires_at = created_at + interval '6 hours')
);

create table private.players (
  id uuid primary key,
  room_id text not null,
  nickname text not null,
  normalized_nickname text not null,
  join_order integer not null,
  state text not null default 'active',
  last_seen_at timestamptz not null default clock_timestamp(),
  created_at timestamptz not null default clock_timestamp(),
  constraint players_room_id_id_key unique (room_id, id),
  constraint players_room_id_join_order_key unique (room_id, join_order),
  constraint players_room_id_fkey
    foreign key (room_id) references private.rooms (id) on delete cascade,
  constraint players_nickname_check
    check (
      nickname = pg_catalog.btrim(nickname)
      and pg_catalog.char_length(nickname) between 2 and 20
      and nickname !~ '[[:cntrl:]]'
    ),
  constraint players_normalized_nickname_check
    check (
      normalized_nickname = pg_catalog.btrim(normalized_nickname)
      and pg_catalog.char_length(normalized_nickname) between 2 and 64
    ),
  constraint players_join_order_check check (join_order > 0),
  constraint players_state_check
    check (state in ('active', 'waiting', 'disconnected', 'removed')),
  constraint players_last_seen_at_check check (last_seen_at >= created_at)
);

create table private.room_sessions (
  id uuid primary key,
  room_id text not null,
  player_id uuid not null,
  player_token_digest text not null,
  host_token_digest text,
  expires_at timestamptz not null,
  revoked_at timestamptz,
  created_at timestamptz not null default clock_timestamp(),
  constraint room_sessions_player_token_digest_key unique (player_token_digest),
  constraint room_sessions_room_player_fkey
    foreign key (room_id, player_id)
    references private.players (room_id, id)
    on delete cascade,
  constraint room_sessions_player_token_digest_check
    check (player_token_digest ~ '^[0-9a-f]{64}$'),
  constraint room_sessions_host_token_digest_check
    check (
      host_token_digest is null
      or host_token_digest ~ '^[0-9a-f]{64}$'
    ),
  constraint room_sessions_expiry_check check (expires_at > created_at),
  constraint room_sessions_revoked_at_check
    check (revoked_at is null or revoked_at >= created_at)
);

create table private.rounds (
  id uuid primary key,
  room_id text not null,
  phase text not null default 'private-reveal',
  version integer not null default 0,
  word_pair_id text not null,
  civilian_word text,
  imposter_word text,
  imposter_player_id uuid,
  started_at timestamptz not null default clock_timestamp(),
  completed_at timestamptz,
  cancelled_at timestamptz,
  imposter_revealed_at timestamptz,
  civilian_revealed_at timestamptz,
  created_at timestamptz not null default clock_timestamp(),
  constraint rounds_room_id_id_key unique (room_id, id),
  constraint rounds_room_id_fkey
    foreign key (room_id) references private.rooms (id) on delete cascade,
  constraint rounds_room_imposter_fkey
    foreign key (room_id, imposter_player_id)
    references private.players (room_id, id)
    deferrable initially deferred,
  constraint rounds_phase_check
    check (phase in (
      'lobby',
      'private-reveal',
      'discussion',
      'imposter-revealed',
      'civilian-revealed',
      'closed'
    )),
  constraint rounds_version_check check (version >= 0),
  constraint rounds_word_pair_id_check
    check (pg_catalog.char_length(pg_catalog.btrim(word_pair_id)) > 0),
  constraint rounds_civilian_word_check
    check (
      civilian_word is null
      or pg_catalog.char_length(pg_catalog.btrim(civilian_word)) > 0
    ),
  constraint rounds_imposter_word_check
    check (
      imposter_word is null
      or pg_catalog.char_length(pg_catalog.btrim(imposter_word)) > 0
    ),
  constraint rounds_completed_at_check
    check (completed_at is null or completed_at >= started_at),
  constraint rounds_cancelled_at_check
    check (cancelled_at is null or cancelled_at >= started_at),
  constraint rounds_imposter_revealed_at_check
    check (imposter_revealed_at is null or imposter_revealed_at >= started_at),
  constraint rounds_civilian_revealed_at_check
    check (civilian_revealed_at is null or civilian_revealed_at >= started_at)
);

create table private.round_players (
  room_id text not null,
  round_id uuid not null,
  player_id uuid not null,
  participation_order integer not null,
  assignment text,
  ready_at timestamptz,
  created_at timestamptz not null default clock_timestamp(),
  primary key (room_id, round_id, player_id),
  constraint round_players_room_round_order_key
    unique (room_id, round_id, participation_order),
  constraint round_players_room_round_fkey
    foreign key (room_id, round_id)
    references private.rounds (room_id, id)
    on delete cascade,
  constraint round_players_room_player_fkey
    foreign key (room_id, player_id)
    references private.players (room_id, id)
    on delete cascade,
  constraint round_players_participation_order_check
    check (participation_order > 0),
  constraint round_players_assignment_check
    check (assignment is null or assignment in ('civilian', 'imposter')),
  constraint round_players_ready_at_check
    check (ready_at is null or ready_at >= created_at)
);

alter table private.rounds
  add constraint rounds_imposter_assignment_fkey
  foreign key (room_id, id, imposter_player_id)
  references private.round_players (room_id, round_id, player_id)
  deferrable initially deferred;

alter table private.rooms
  add constraint rooms_host_player_fkey
  foreign key (id, host_player_id)
  references private.players (room_id, id)
  deferrable initially deferred,
  add constraint rooms_current_round_fkey
  foreign key (id, current_round_id)
  references private.rounds (room_id, id)
  deferrable initially deferred;

create table private.rate_limit_buckets (
  key_digest text not null,
  action text not null,
  window_started_at timestamptz not null,
  request_count integer not null default 1,
  expires_at timestamptz not null,
  updated_at timestamptz not null default clock_timestamp(),
  primary key (key_digest, action, window_started_at),
  constraint rate_limit_buckets_key_digest_check
    check (key_digest ~ '^[0-9a-f]{64}$'),
  constraint rate_limit_buckets_action_check
    check (
      action = pg_catalog.btrim(action)
      and pg_catalog.char_length(action) between 1 and 64
    ),
  constraint rate_limit_buckets_request_count_check check (request_count > 0),
  constraint rate_limit_buckets_expiry_check
    check (expires_at > window_started_at),
  constraint rate_limit_buckets_updated_at_check
    check (updated_at >= window_started_at)
);

create unique index players_active_nickname_key
  on private.players (room_id, normalized_nickname)
  where state <> 'removed';

create index players_room_membership_idx
  on private.players (room_id, state, join_order);

create index players_heartbeat_cleanup_idx
  on private.players (last_seen_at)
  where state <> 'removed';

create index room_sessions_lookup_idx
  on private.room_sessions (room_id, id, player_token_digest)
  where revoked_at is null;

create index rounds_active_room_idx
  on private.rounds (room_id, started_at desc)
  where completed_at is null and cancelled_at is null;

create index rooms_host_heartbeat_cleanup_idx
  on private.rooms (host_last_seen_at)
  where phase <> 'closed';

create index rooms_expiry_cleanup_idx
  on private.rooms (expires_at)
  where phase <> 'closed';

create index rate_limit_buckets_expiry_idx
  on private.rate_limit_buckets (expires_at);

comment on table private.rooms is
  'Authoritative online room state. Raw capability tokens must never be stored.';
comment on table private.players is
  'Account-free room participants. Raw capability tokens must never be stored.';
comment on table private.room_sessions is
  'Room-scoped capability digests only. Raw capability tokens must never be stored.';
comment on table private.rounds is
  'Server-only online round state. Raw capability tokens must never be stored.';
comment on table private.round_players is
  'Immutable per-round assignments. Raw capability tokens must never be stored.';
comment on table private.rate_limit_buckets is
  'Hashed fixed-window request buckets. Raw capability tokens must never be stored.';

revoke all privileges on all tables in schema private
  from public, quickimposter_app;
revoke all privileges on all sequences in schema private
  from public, quickimposter_app;

alter default privileges in schema private
  revoke all privileges on tables from public;
alter default privileges in schema private
  revoke all privileges on sequences from public;
