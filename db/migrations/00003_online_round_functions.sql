create function private.lock_online_room_command(
  p_room_id text,
  p_session_id uuid,
  p_player_digest text,
  p_host_digest text,
  p_expected_version integer,
  p_require_host boolean
)
returns private.rooms
language plpgsql
security definer
set search_path = pg_catalog, private
as $function$
declare
  v_room private.rooms%rowtype;
  v_player_id uuid;
begin
  select *
  into v_room
  from private.rooms
  where id = p_room_id
  for update;

  if not found then
    raise exception using errcode = 'P0001', message = 'not-found';
  end if;

  perform private.cleanup_online_room(p_room_id);

  select *
  into strict v_room
  from private.rooms
  where id = p_room_id;

  if v_room.phase = 'closed' or v_room.expires_at <= pg_catalog.clock_timestamp() then
    raise exception using errcode = 'P0001', message = 'room-closed';
  end if;

  if p_expected_version is null or p_expected_version <> v_room.version then
    raise exception using errcode = 'P0001', message = 'conflict';
  end if;

  select room_session.player_id
  into v_player_id
  from private.room_sessions as room_session
  join private.players as player
    on player.room_id = room_session.room_id
   and player.id = room_session.player_id
  where room_session.room_id = p_room_id
    and room_session.id = p_session_id
    and room_session.player_token_digest = p_player_digest
    and room_session.revoked_at is null
    and room_session.expires_at > pg_catalog.clock_timestamp()
    and player.state <> 'removed'
    and (
      not p_require_host
      or (
        room_session.player_id = v_room.host_player_id
        and room_session.host_token_digest = p_host_digest
      )
    );

  if not found then
    raise exception using errcode = 'P0001', message = 'unauthorized';
  end if;

  return v_room;
end
$function$;

create function private.get_online_recent_pair_ids(
  p_room_id text,
  p_session_id uuid,
  p_player_digest text,
  p_host_digest text
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, private
as $function$
declare
  v_room private.rooms%rowtype;
begin
  select *
  into v_room
  from private.rooms
  where id = p_room_id
  for update;

  if not found then
    raise exception using errcode = 'P0001', message = 'not-found';
  end if;

  perform private.cleanup_online_room(p_room_id);

  select *
  into strict v_room
  from private.rooms
  where id = p_room_id;

  if v_room.phase = 'closed' or v_room.expires_at <= pg_catalog.clock_timestamp() then
    raise exception using errcode = 'P0001', message = 'room-closed';
  end if;

  if not exists (
    select 1
    from private.room_sessions as room_session
    where room_session.room_id = p_room_id
      and room_session.id = p_session_id
      and room_session.player_id = v_room.host_player_id
      and room_session.player_token_digest = p_player_digest
      and room_session.host_token_digest = p_host_digest
      and room_session.revoked_at is null
      and room_session.expires_at > pg_catalog.clock_timestamp()
  ) then
    raise exception using errcode = 'P0001', message = 'unauthorized';
  end if;

  return pg_catalog.jsonb_build_object(
    'category', v_room.category,
    'recentPairIds', coalesce((
      select pg_catalog.jsonb_agg(recent.word_pair_id order by recent.started_at desc)
      from (
        select round.word_pair_id, round.started_at
        from private.rounds as round
        where round.room_id = p_room_id
          and round.cancelled_at is null
        order by round.started_at desc
        limit 30
      ) as recent
    ), '[]'::jsonb)
  );
end
$function$;

create function private.get_online_player_secret(
  p_room_id text,
  p_session_id uuid,
  p_player_digest text
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, private
as $function$
declare
  v_room private.rooms%rowtype;
  v_word text;
begin
  select *
  into v_room
  from private.rooms
  where id = p_room_id
  for update;

  if not found then
    raise exception using errcode = 'P0001', message = 'not-found';
  end if;

  perform private.cleanup_online_room(p_room_id);

  select *
  into strict v_room
  from private.rooms
  where id = p_room_id;

  if v_room.phase = 'closed' or v_room.expires_at <= pg_catalog.clock_timestamp() then
    raise exception using errcode = 'P0001', message = 'room-closed';
  end if;

  if v_room.phase <> 'private-reveal' then
    raise exception using errcode = 'P0001', message = 'conflict';
  end if;

  select case round_player.assignment
      when 'imposter' then round.imposter_word
      when 'civilian' then round.civilian_word
    end
  into v_word
  from private.room_sessions as room_session
  join private.round_players as round_player
    on round_player.room_id = room_session.room_id
   and round_player.round_id = v_room.current_round_id
   and round_player.player_id = room_session.player_id
  join private.rounds as round
    on round.room_id = round_player.room_id
   and round.id = round_player.round_id
  where room_session.room_id = p_room_id
    and room_session.id = p_session_id
    and room_session.player_token_digest = p_player_digest
    and room_session.revoked_at is null
    and room_session.expires_at > pg_catalog.clock_timestamp();

  if not found or v_word is null then
    raise exception using errcode = 'P0001', message = 'unauthorized';
  end if;

  return pg_catalog.jsonb_build_object('word', v_word);
end
$function$;

create function private.start_online_round(
  p_room_id text,
  p_session_id uuid,
  p_player_digest text,
  p_host_digest text,
  p_expected_version integer,
  p_round jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, private
as $function$
declare
  v_room private.rooms%rowtype;
  v_round_id uuid;
  v_imposter_player_id uuid;
  v_participant_count integer;
  v_now timestamptz := pg_catalog.clock_timestamp();
begin
  v_room := private.lock_online_room_command(
    p_room_id,
    p_session_id,
    p_player_digest,
    p_host_digest,
    p_expected_version,
    true
  );

  if v_room.phase <> 'lobby' then
    raise exception using errcode = 'P0001', message = 'conflict';
  end if;

  begin
    v_round_id := (p_round ->> 'id')::uuid;
  exception when others then
    raise exception using errcode = 'P0001', message = 'invalid-request';
  end;

  if v_round_id is null
     or coalesce(p_round ->> 'category', '') not in (
       'Food',
       'Animals',
       'Objects',
       'Places',
       'Entertainment',
       'Sports',
       'Jobs',
       'Nature'
     )
     or (
       v_room.category <> 'All Categories'
       and p_round ->> 'category' is distinct from v_room.category
     )
     or coalesce(pg_catalog.char_length(pg_catalog.btrim(p_round ->> 'wordPairId')), 0) = 0
     or coalesce(pg_catalog.char_length(pg_catalog.btrim(p_round ->> 'civilianWord')), 0) = 0
     or coalesce(pg_catalog.char_length(pg_catalog.btrim(p_round ->> 'imposterWord')), 0) = 0 then
    raise exception using errcode = 'P0001', message = 'invalid-request';
  end if;

  select pg_catalog.count(*)::integer
  into v_participant_count
  from private.players
  where room_id = p_room_id
    and state = 'active';

  if v_participant_count not between 3 and 12 then
    raise exception using errcode = 'P0001', message = 'invalid-request';
  end if;

  select id
  into v_imposter_player_id
  from private.players
  where room_id = p_room_id
    and state = 'active'
  order by pg_catalog.gen_random_uuid()
  limit 1;

  begin
    insert into private.rounds (
      id, room_id, phase, version, word_pair_id, civilian_word,
      imposter_word, started_at, created_at
    )
    values (
      v_round_id,
      p_room_id,
      'private-reveal',
      v_room.version + 1,
      p_round ->> 'wordPairId',
      p_round ->> 'civilianWord',
      p_round ->> 'imposterWord',
      v_now,
      v_now
    );

    insert into private.round_players (
      room_id, round_id, player_id, participation_order,
      assignment, created_at
    )
    select
      p_room_id,
      v_round_id,
      player.id,
      row_number() over (order by player.join_order)::integer,
      case when player.id = v_imposter_player_id then 'imposter' else 'civilian' end,
      v_now
    from private.players as player
    where player.room_id = p_room_id
      and player.state = 'active'
    order by player.join_order;

    update private.rounds
    set imposter_player_id = v_imposter_player_id
    where room_id = p_room_id
      and id = v_round_id;
  exception
    when unique_violation or check_violation or not_null_violation or foreign_key_violation then
      raise exception using errcode = 'P0001', message = 'invalid-request';
  end;

  update private.rooms
  set current_round_id = v_round_id,
      phase = 'private-reveal',
      version = version + 1,
      updated_at = v_now
  where id = p_room_id;

  return pg_catalog.jsonb_build_object('ok', true, 'version', v_room.version + 1);
end
$function$;

create function private.mark_online_player_ready(
  p_room_id text,
  p_session_id uuid,
  p_player_digest text,
  p_expected_version integer
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, private
as $function$
declare
  v_room private.rooms%rowtype;
  v_player_id uuid;
  v_everyone_ready boolean;
  v_now timestamptz := pg_catalog.clock_timestamp();
begin
  v_room := private.lock_online_room_command(
    p_room_id,
    p_session_id,
    p_player_digest,
    null,
    p_expected_version,
    false
  );

  if v_room.phase <> 'private-reveal' then
    raise exception using errcode = 'P0001', message = 'conflict';
  end if;

  select room_session.player_id
  into v_player_id
  from private.room_sessions as room_session
  join private.round_players as round_player
    on round_player.room_id = room_session.room_id
   and round_player.round_id = v_room.current_round_id
   and round_player.player_id = room_session.player_id
  where room_session.room_id = p_room_id
    and room_session.id = p_session_id
    and room_session.player_token_digest = p_player_digest
    and round_player.ready_at is null;

  if not found then
    raise exception using errcode = 'P0001', message = 'conflict';
  end if;

  update private.round_players
  set ready_at = v_now
  where room_id = p_room_id
    and round_id = v_room.current_round_id
    and player_id = v_player_id;

  select not exists (
    select 1
    from private.round_players
    where room_id = p_room_id
      and round_id = v_room.current_round_id
      and ready_at is null
  ) into v_everyone_ready;

  update private.rounds
  set phase = case when v_everyone_ready then 'discussion' else phase end,
      version = v_room.version + 1
  where room_id = p_room_id
    and id = v_room.current_round_id;

  update private.rooms
  set phase = case when v_everyone_ready then 'discussion' else phase end,
      version = version + 1,
      updated_at = v_now
  where id = p_room_id;

  return pg_catalog.jsonb_build_object('ok', true, 'version', v_room.version + 1);
end
$function$;

create function private.reveal_online_imposter(
  p_room_id text,
  p_session_id uuid,
  p_player_digest text,
  p_host_digest text,
  p_expected_version integer
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, private
as $function$
declare
  v_room private.rooms%rowtype;
  v_now timestamptz := pg_catalog.clock_timestamp();
begin
  v_room := private.lock_online_room_command(
    p_room_id, p_session_id, p_player_digest, p_host_digest,
    p_expected_version, true
  );

  if v_room.phase <> 'discussion' then
    raise exception using errcode = 'P0001', message = 'conflict';
  end if;

  update private.rounds
  set phase = 'imposter-revealed',
      version = v_room.version + 1,
      imposter_revealed_at = v_now
  where room_id = p_room_id
    and id = v_room.current_round_id;

  update private.rooms
  set phase = 'imposter-revealed',
      version = version + 1,
      updated_at = v_now
  where id = p_room_id;

  return pg_catalog.jsonb_build_object('ok', true, 'version', v_room.version + 1);
end
$function$;

create function private.reveal_online_civilian(
  p_room_id text,
  p_session_id uuid,
  p_player_digest text,
  p_host_digest text,
  p_expected_version integer
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, private
as $function$
declare
  v_room private.rooms%rowtype;
  v_now timestamptz := pg_catalog.clock_timestamp();
begin
  v_room := private.lock_online_room_command(
    p_room_id, p_session_id, p_player_digest, p_host_digest,
    p_expected_version, true
  );

  if v_room.phase <> 'imposter-revealed' then
    raise exception using errcode = 'P0001', message = 'conflict';
  end if;

  update private.rounds
  set phase = 'civilian-revealed',
      version = v_room.version + 1,
      completed_at = v_now,
      civilian_revealed_at = v_now
  where room_id = p_room_id
    and id = v_room.current_round_id;

  update private.rooms
  set phase = 'civilian-revealed',
      version = version + 1,
      updated_at = v_now
  where id = p_room_id;

  return pg_catalog.jsonb_build_object('ok', true, 'version', v_room.version + 1);
end
$function$;

create function private.replay_online_room(
  p_room_id text,
  p_session_id uuid,
  p_player_digest text,
  p_host_digest text,
  p_expected_version integer
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, private
as $function$
declare
  v_room private.rooms%rowtype;
  v_now timestamptz := pg_catalog.clock_timestamp();
begin
  v_room := private.lock_online_room_command(
    p_room_id, p_session_id, p_player_digest, p_host_digest,
    p_expected_version, true
  );

  if v_room.phase <> 'civilian-revealed' then
    raise exception using errcode = 'P0001', message = 'conflict';
  end if;

  update private.players
  set state = 'active'
  where room_id = p_room_id
    and state = 'waiting';

  update private.rooms
  set current_round_id = null,
      phase = 'lobby',
      version = version + 1,
      updated_at = v_now
  where id = p_room_id;

  return pg_catalog.jsonb_build_object('ok', true, 'version', v_room.version + 1);
end
$function$;

create function private.cancel_online_round(
  p_room_id text,
  p_session_id uuid,
  p_player_digest text,
  p_host_digest text,
  p_expected_version integer
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, private
as $function$
declare
  v_room private.rooms%rowtype;
  v_now timestamptz := pg_catalog.clock_timestamp();
begin
  v_room := private.lock_online_room_command(
    p_room_id, p_session_id, p_player_digest, p_host_digest,
    p_expected_version, true
  );

  if v_room.phase <> 'private-reveal' then
    raise exception using errcode = 'P0001', message = 'conflict';
  end if;

  update private.round_players
  set assignment = null
  where room_id = p_room_id
    and round_id = v_room.current_round_id;

  update private.rounds
  set phase = 'lobby',
      version = v_room.version + 1,
      civilian_word = null,
      imposter_word = null,
      imposter_player_id = null,
      cancelled_at = v_now
  where room_id = p_room_id
    and id = v_room.current_round_id;

  update private.players
  set state = 'active'
  where room_id = p_room_id
    and state = 'waiting';

  update private.rooms
  set current_round_id = null,
      phase = 'lobby',
      version = version + 1,
      updated_at = v_now
  where id = p_room_id;

  return pg_catalog.jsonb_build_object('ok', true, 'version', v_room.version + 1);
end
$function$;

create function private.close_online_room(
  p_room_id text,
  p_session_id uuid,
  p_player_digest text,
  p_host_digest text,
  p_expected_version integer
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, private
as $function$
declare
  v_room private.rooms%rowtype;
  v_now timestamptz := pg_catalog.clock_timestamp();
begin
  v_room := private.lock_online_room_command(
    p_room_id, p_session_id, p_player_digest, p_host_digest,
    p_expected_version, true
  );

  update private.round_players
  set assignment = null
  where room_id = p_room_id;

  update private.rounds
  set phase = 'closed',
      version = v_room.version + 1,
      civilian_word = null,
      imposter_word = null,
      imposter_player_id = null
  where room_id = p_room_id;

  update private.room_sessions
  set revoked_at = coalesce(revoked_at, v_now)
  where room_id = p_room_id;

  update private.rooms
  set phase = 'closed',
      version = version + 1,
      updated_at = v_now,
      closed_at = v_now
  where id = p_room_id;

  return pg_catalog.jsonb_build_object('ok', true, 'version', v_room.version + 1);
end
$function$;

revoke execute on function private.lock_online_room_command(text, uuid, text, text, integer, boolean) from public;
revoke execute on function private.get_online_recent_pair_ids(text, uuid, text, text) from public;
revoke execute on function private.get_online_player_secret(text, uuid, text) from public;
revoke execute on function private.start_online_round(text, uuid, text, text, integer, jsonb) from public;
revoke execute on function private.mark_online_player_ready(text, uuid, text, integer) from public;
revoke execute on function private.reveal_online_imposter(text, uuid, text, text, integer) from public;
revoke execute on function private.reveal_online_civilian(text, uuid, text, text, integer) from public;
revoke execute on function private.replay_online_room(text, uuid, text, text, integer) from public;
revoke execute on function private.cancel_online_round(text, uuid, text, text, integer) from public;
revoke execute on function private.close_online_room(text, uuid, text, text, integer) from public;

revoke execute on function private.lock_online_room_command(text, uuid, text, text, integer, boolean) from quickimposter_app;
grant execute on function private.get_online_recent_pair_ids(text, uuid, text, text) to quickimposter_app;
grant execute on function private.get_online_player_secret(text, uuid, text) to quickimposter_app;
grant execute on function private.start_online_round(text, uuid, text, text, integer, jsonb) to quickimposter_app;
grant execute on function private.mark_online_player_ready(text, uuid, text, integer) to quickimposter_app;
grant execute on function private.reveal_online_imposter(text, uuid, text, text, integer) to quickimposter_app;
grant execute on function private.reveal_online_civilian(text, uuid, text, text, integer) to quickimposter_app;
grant execute on function private.replay_online_room(text, uuid, text, text, integer) to quickimposter_app;
grant execute on function private.cancel_online_round(text, uuid, text, text, integer) to quickimposter_app;
grant execute on function private.close_online_room(text, uuid, text, text, integer) to quickimposter_app;
