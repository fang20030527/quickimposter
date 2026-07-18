create function private.cleanup_online_room(p_room_id text)
returns void
language plpgsql
security definer
set search_path = pg_catalog, private
as $function$
declare
  v_now timestamptz := pg_catalog.clock_timestamp();
  v_room private.rooms%rowtype;
begin
  select *
  into v_room
  from private.rooms
  where id = p_room_id
  for update;

  if not found or v_room.phase = 'closed' then
    return;
  end if;

  if v_room.expires_at > v_now
     and v_room.host_last_seen_at > v_now - interval '5 minutes' then
    return;
  end if;

  update private.rounds
  set civilian_word = null,
      imposter_word = null,
      imposter_player_id = null,
      completed_at = coalesce(completed_at, v_now)
  where room_id = p_room_id;

  update private.round_players
  set assignment = null
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
end
$function$;

-- The direct migration owner must be able to assume the no-login runtime role
-- for privilege-isolated integration tests.
grant quickimposter_app to current_user;

create function private.build_online_room_snapshot(
  p_room_id text,
  p_viewer_player_id uuid
)
returns jsonb
language sql
stable
security definer
set search_path = pg_catalog, private
as $function$
  select pg_catalog.jsonb_build_object(
    'roomId', room.id,
    'phase', room.phase,
    'version', room.version,
    'category', room.category,
    'viewerPlayerId', p_viewer_player_id,
    'viewerIsHost', p_viewer_player_id is not null
      and p_viewer_player_id = room.host_player_id,
    'players', coalesce((
      select pg_catalog.jsonb_agg(
        pg_catalog.jsonb_build_object(
          'id', player.id,
          'nickname', player.nickname,
          'state', player.state,
          'isHost', player.id = room.host_player_id,
          'isReady', round_player.ready_at is not null
        ) order by player.join_order
      )
      from private.players as player
      left join private.round_players as round_player
        on round_player.room_id = player.room_id
       and round_player.round_id = room.current_round_id
       and round_player.player_id = player.id
      where player.room_id = room.id
        and player.state <> 'removed'
    ), '[]'::jsonb),
    'readyCount', (
      select pg_catalog.count(*)::integer
      from private.round_players as round_player
      where round_player.room_id = room.id
        and round_player.round_id = room.current_round_id
        and round_player.ready_at is not null
    ),
    'participantCount', case
      when room.current_round_id is not null then (
        select pg_catalog.count(*)::integer
        from private.round_players as round_player
        where round_player.room_id = room.id
          and round_player.round_id = room.current_round_id
      )
      else (
        select pg_catalog.count(*)::integer
        from private.players as player
        where player.room_id = room.id
          and player.state = 'active'
      )
    end,
    'hostAwaySince', case
      when room.host_last_seen_at <= pg_catalog.statement_timestamp() - interval '30 seconds'
        then pg_catalog.to_jsonb(room.host_last_seen_at)
      else null
    end,
    'expiresAt', pg_catalog.to_jsonb(room.expires_at),
    'result', case
      when room.phase in ('imposter-revealed', 'civilian-revealed') then (
        select pg_catalog.jsonb_build_object(
          'imposterNickname', imposter.nickname,
          'imposterWord', round.imposter_word,
          'civilianWord', case
            when room.phase = 'civilian-revealed' then round.civilian_word
            else null
          end
        )
        from private.rounds as round
        join private.players as imposter
          on imposter.room_id = round.room_id
         and imposter.id = round.imposter_player_id
        where round.room_id = room.id
          and round.id = room.current_round_id
      )
      else null
    end
  )
  from private.rooms as room
  where room.id = p_room_id
$function$;

create function private.create_online_room(
  p_room jsonb,
  p_player jsonb,
  p_session jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, private
as $function$
declare
  v_now timestamptz := pg_catalog.clock_timestamp();
  v_room_id text := p_room ->> 'id';
  v_player_id uuid;
  v_session_player_id uuid;
  v_session_id uuid;
begin
  begin
    v_player_id := (p_player ->> 'id')::uuid;
    v_session_player_id := (p_session ->> 'playerId')::uuid;
    v_session_id := (p_session ->> 'id')::uuid;
  exception when others then
    raise exception using errcode = 'P0001', message = 'invalid-request';
  end;

  if v_room_id is null
     or v_player_id is null
     or v_session_player_id is distinct from v_player_id
     or p_session ->> 'hostTokenDigest' is null then
    raise exception using errcode = 'P0001', message = 'invalid-request';
  end if;

  begin
    insert into private.rooms (
      id, category, host_last_seen_at, created_at, updated_at, expires_at
    )
    values (
      v_room_id,
      p_room ->> 'category',
      v_now,
      v_now,
      v_now,
      v_now + interval '6 hours'
    );

    insert into private.players (
      id, room_id, nickname, normalized_nickname, join_order,
      state, last_seen_at, created_at
    )
    values (
      v_player_id,
      v_room_id,
      p_player ->> 'nickname',
      p_player ->> 'normalizedNickname',
      1,
      'active',
      v_now,
      v_now
    );

    insert into private.room_sessions (
      id, room_id, player_id, player_token_digest,
      host_token_digest, expires_at, created_at
    )
    values (
      v_session_id,
      v_room_id,
      v_player_id,
      p_session ->> 'playerTokenDigest',
      p_session ->> 'hostTokenDigest',
      v_now + interval '6 hours',
      v_now
    );

    update private.rooms
    set host_player_id = v_player_id
    where id = v_room_id;
  exception
    when unique_violation or check_violation or not_null_violation or foreign_key_violation then
      raise exception using errcode = 'P0001', message = 'invalid-request';
  end;

  return private.build_online_room_snapshot(v_room_id, v_player_id);
end
$function$;

create function private.join_online_room(
  p_room_id text,
  p_player jsonb,
  p_session jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, private
as $function$
declare
  v_now timestamptz := pg_catalog.clock_timestamp();
  v_room private.rooms%rowtype;
  v_player_id uuid;
  v_session_player_id uuid;
  v_session_id uuid;
  v_join_order integer;
  v_player_state text;
  v_constraint_name text;
begin
  begin
    v_player_id := (p_player ->> 'id')::uuid;
    v_session_player_id := (p_session ->> 'playerId')::uuid;
    v_session_id := (p_session ->> 'id')::uuid;
  exception when others then
    raise exception using errcode = 'P0001', message = 'invalid-request';
  end;

  if v_player_id is null
     or v_session_player_id is distinct from v_player_id
     or p_session ->> 'hostTokenDigest' is not null then
    raise exception using errcode = 'P0001', message = 'invalid-request';
  end if;

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

  if v_room.phase = 'closed' then
    raise exception using errcode = 'P0001', message = 'room-closed';
  end if;

  if (
    select pg_catalog.count(*)
    from private.players
    where room_id = p_room_id
      and state <> 'removed'
  ) >= 12 then
    raise exception using errcode = 'P0001', message = 'room-full';
  end if;

  select coalesce(pg_catalog.max(join_order), 0) + 1
  into v_join_order
  from private.players
  where room_id = p_room_id;

  v_player_state := case when v_room.phase = 'lobby' then 'active' else 'waiting' end;

  begin
    insert into private.players (
      id, room_id, nickname, normalized_nickname, join_order,
      state, last_seen_at, created_at
    )
    values (
      v_player_id,
      p_room_id,
      p_player ->> 'nickname',
      p_player ->> 'normalizedNickname',
      v_join_order,
      v_player_state,
      v_now,
      v_now
    );

    insert into private.room_sessions (
      id, room_id, player_id, player_token_digest, expires_at, created_at
    )
    values (
      v_session_id,
      p_room_id,
      v_player_id,
      p_session ->> 'playerTokenDigest',
      v_room.expires_at,
      v_now
    );
  exception
    when unique_violation then
      get stacked diagnostics v_constraint_name = CONSTRAINT_NAME;
      if v_constraint_name = 'players_active_nickname_key' then
        raise exception using errcode = 'P0001', message = 'nickname-taken';
      end if;
      raise exception using errcode = 'P0001', message = 'invalid-request';
    when check_violation or not_null_violation or foreign_key_violation then
      raise exception using errcode = 'P0001', message = 'invalid-request';
  end;

  update private.rooms
  set version = version + 1,
      updated_at = v_now
  where id = p_room_id;

  return private.build_online_room_snapshot(p_room_id, v_player_id);
end
$function$;

create function private.get_online_room_snapshot(
  p_room_id text,
  p_session_id uuid,
  p_player_digest text,
  p_known_version integer
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, private
as $function$
declare
  v_room private.rooms%rowtype;
  v_viewer_player_id uuid;
begin
  perform private.cleanup_online_room(p_room_id);

  select *
  into v_room
  from private.rooms
  where id = p_room_id;

  if not found then
    raise exception using errcode = 'P0001', message = 'not-found';
  end if;

  if v_room.phase = 'closed' then
    raise exception using errcode = 'P0001', message = 'room-closed';
  end if;

  if p_session_id is not null or p_player_digest is not null then
    if p_session_id is null or p_player_digest is null then
      raise exception using errcode = 'P0001', message = 'unauthorized';
    end if;

    select session.player_id
    into v_viewer_player_id
    from private.room_sessions as session
    where session.room_id = p_room_id
      and session.id = p_session_id
      and session.player_token_digest = p_player_digest
      and session.revoked_at is null
      and session.expires_at > pg_catalog.clock_timestamp();

    if not found then
      raise exception using errcode = 'P0001', message = 'unauthorized';
    end if;
  end if;

  if p_known_version is not null and p_known_version = v_room.version then
    return pg_catalog.jsonb_build_object(
      'changed', false,
      'version', v_room.version
    );
  end if;

  return pg_catalog.jsonb_build_object(
    'changed', true,
    'snapshot', private.build_online_room_snapshot(p_room_id, v_viewer_player_id)
  );
end
$function$;

create function private.heartbeat_online_room(
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
  v_now timestamptz := pg_catalog.clock_timestamp();
  v_player_id uuid;
  v_is_host boolean;
begin
  perform private.cleanup_online_room(p_room_id);

  select session.player_id, room.host_player_id = session.player_id
  into v_player_id, v_is_host
  from private.room_sessions as session
  join private.rooms as room on room.id = session.room_id
  where session.room_id = p_room_id
    and session.id = p_session_id
    and session.player_token_digest = p_player_digest
    and session.revoked_at is null
    and session.expires_at > v_now
    and room.phase <> 'closed';

  if not found then
    raise exception using errcode = 'P0001', message = 'unauthorized';
  end if;

  update private.players
  set last_seen_at = v_now,
      state = case when state = 'disconnected' then 'active' else state end
  where room_id = p_room_id
    and id = v_player_id
    and state <> 'removed';

  if v_is_host then
    update private.rooms
    set host_last_seen_at = v_now
    where id = p_room_id;
  end if;

  return pg_catalog.jsonb_build_object('ok', true);
end
$function$;

create function private.check_online_rate_limit(
  p_key_digest text,
  p_action text,
  p_limit integer,
  p_window_seconds integer
)
returns boolean
language plpgsql
security definer
set search_path = pg_catalog, private
as $function$
declare
  v_now timestamptz := pg_catalog.clock_timestamp();
  v_window_start timestamptz;
  v_count integer;
begin
  if p_key_digest is null
     or p_key_digest !~ '^[0-9a-f]{64}$'
     or p_action is null
     or p_action <> pg_catalog.btrim(p_action)
     or pg_catalog.char_length(p_action) not between 1 and 64
     or p_limit is null
     or p_limit <= 0
     or p_window_seconds is null
     or p_window_seconds <= 0 then
    raise exception using errcode = 'P0001', message = 'invalid-request';
  end if;

  v_window_start := pg_catalog.to_timestamp(
    pg_catalog.floor(extract(epoch from v_now) / p_window_seconds)
      * p_window_seconds
  );

  insert into private.rate_limit_buckets (
    key_digest, action, window_started_at, request_count, expires_at, updated_at
  )
  values (
    p_key_digest,
    p_action,
    v_window_start,
    1,
    v_window_start + pg_catalog.make_interval(secs => p_window_seconds),
    v_now
  )
  on conflict (key_digest, action, window_started_at)
  do update
  set request_count = private.rate_limit_buckets.request_count + 1,
      updated_at = excluded.updated_at
  returning request_count into v_count;

  return v_count <= p_limit;
end
$function$;

revoke execute on function private.cleanup_online_room(text) from public;
revoke execute on function private.build_online_room_snapshot(text, uuid) from public;
revoke execute on function private.create_online_room(jsonb, jsonb, jsonb) from public;
revoke execute on function private.join_online_room(text, jsonb, jsonb) from public;
revoke execute on function private.get_online_room_snapshot(text, uuid, text, integer) from public;
revoke execute on function private.heartbeat_online_room(text, uuid, text) from public;
revoke execute on function private.check_online_rate_limit(text, text, integer, integer) from public;

revoke execute on function private.build_online_room_snapshot(text, uuid) from quickimposter_app;
grant execute on function private.cleanup_online_room(text) to quickimposter_app;
grant execute on function private.create_online_room(jsonb, jsonb, jsonb) to quickimposter_app;
grant execute on function private.join_online_room(text, jsonb, jsonb) to quickimposter_app;
grant execute on function private.get_online_room_snapshot(text, uuid, text, integer) to quickimposter_app;
grant execute on function private.heartbeat_online_room(text, uuid, text) to quickimposter_app;
grant execute on function private.check_online_rate_limit(text, text, integer, integer) to quickimposter_app;
