import type { PoolClient } from 'pg'
import type { Migration } from '../migrationRunner.js'

export const migration002: Migration = {
  version: 2,
  name: 'create_tenant_tables',
  up: async (client: PoolClient) => {
    await client.query(`
      CREATE TABLE scenes (
        id TEXT NOT NULL,
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        label TEXT NOT NULL,
        background_opaque BOOLEAN NOT NULL DEFAULT FALSE,
        sources_json JSONB NOT NULL DEFAULT '[]',
        style_json JSONB,
        lobby_config_json JSONB,
        transitions_json JSONB,
        PRIMARY KEY (user_id, id)
      )
    `)

    await client.query(`
      CREATE TABLE applications (
        id TEXT NOT NULL,
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        label TEXT NOT NULL,
        icon TEXT NOT NULL DEFAULT '',
        app_type TEXT NOT NULL,
        target_scene_id TEXT NOT NULL DEFAULT '',
        widget_source TEXT,
        widget_component TEXT,
        icon_position_x REAL,
        icon_position_y REAL,
        icon_size TEXT,
        settings_json JSONB,
        PRIMARY KEY (user_id, id)
      )
    `)

    await client.query(`
      CREATE TABLE desktop_config (
        user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
        global_theme_json JSONB,
        icon_animation TEXT,
        icon_arrangement TEXT,
        icon_motion REAL,
        icon_arrangement_motion REAL,
        default_icon_size TEXT,
        auto_arrange_icons BOOLEAN,
        recycle_bin_json JSONB,
        screen_saver_json JSONB,
        system_sounds_json JSONB,
        widget_positions_json JSONB,
        widget_sizes_json JSONB,
        widget_z_indices_json JSONB,
        widget_default_z_indices_json JSONB
      )
    `)

    await client.query(`
      CREATE TABLE widget_layouts (
        id TEXT NOT NULL,
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        label TEXT NOT NULL,
        icon TEXT NOT NULL DEFAULT '',
        source TEXT NOT NULL DEFAULT 'user',
        description TEXT,
        items_json JSONB NOT NULL DEFAULT '[]',
        default_config_json JSONB,
        PRIMARY KEY (user_id, id)
      )
    `)

    await client.query(`
      CREATE TABLE events (
        id TEXT NOT NULL,
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        label TEXT NOT NULL,
        icon TEXT NOT NULL DEFAULT '',
        color TEXT NOT NULL DEFAULT '',
        "desc" TEXT NOT NULL DEFAULT '',
        effects_json JSONB NOT NULL DEFAULT '[]',
        actions_json JSONB,
        auto_json JSONB NOT NULL,
        PRIMARY KEY (user_id, id)
      )
    `)

    await client.query(`
      CREATE TABLE keybinds (
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        scope TEXT NOT NULL,
        key TEXT NOT NULL,
        action TEXT NOT NULL,
        PRIMARY KEY (user_id, scope, key)
      )
    `)

    await client.query(`
      CREATE TABLE obs_config (
        user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
        url TEXT NOT NULL DEFAULT '',
        password TEXT NOT NULL DEFAULT ''
      )
    `)

    await client.query(`
      CREATE TABLE audio_config (
        user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
        master_volume REAL NOT NULL DEFAULT 1,
        sfx_volume REAL NOT NULL DEFAULT 1,
        music_volume REAL NOT NULL DEFAULT 0.7
      )
    `)

    await client.query(`
      CREATE TABLE overlay_style (
        user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
        background_json JSONB,
        effects_json JSONB,
        particles_json JSONB,
        font_family TEXT,
        accent_color TEXT,
        text_color TEXT
      )
    `)

    await client.query(`
      CREATE TABLE desktop_ambiance (
        user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
        simulation_json JSONB
      )
    `)

    await client.query(`
      CREATE TABLE source_presets (
        id TEXT NOT NULL,
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        label TEXT NOT NULL,
        plugin_type TEXT NOT NULL,
        config_json JSONB NOT NULL DEFAULT '{}',
        default_position_json JSONB,
        PRIMARY KEY (user_id, id)
      )
    `)

    await client.query(`
      CREATE TABLE media_library (
        id TEXT NOT NULL,
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        name TEXT NOT NULL,
        type TEXT NOT NULL,
        url TEXT NOT NULL,
        duration REAL,
        PRIMARY KEY (user_id, id)
      )
    `)

    await client.query(`
      CREATE TABLE pov_config (
        user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
        poll_interval_ms INTEGER NOT NULL DEFAULT 100,
        rolling_window_ms INTEGER NOT NULL DEFAULT 2000,
        cooldown_ms INTEGER NOT NULL DEFAULT 3000,
        activity_threshold REAL NOT NULL DEFAULT 0.15,
        silence_threshold REAL NOT NULL DEFAULT 0.05,
        health_check_interval_ms INTEGER NOT NULL DEFAULT 10000,
        max_connections INTEGER NOT NULL DEFAULT 10,
        transition_type TEXT NOT NULL DEFAULT 'cut',
        transition_duration_ms INTEGER NOT NULL DEFAULT 0,
        score_emit_interval_ms INTEGER NOT NULL DEFAULT 500,
        db_floor REAL NOT NULL DEFAULT -60,
        db_ceiling REAL NOT NULL DEFAULT 0
      )
    `)

    await client.query(`
      CREATE TABLE pov_feeds (
        id TEXT NOT NULL,
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        label TEXT NOT NULL,
        obs_address TEXT NOT NULL,
        obs_password TEXT NOT NULL DEFAULT '',
        scene_name TEXT NOT NULL,
        registered_at BIGINT NOT NULL,
        PRIMARY KEY (user_id, id)
      )
    `)

    await client.query(`
      CREATE TABLE online_config (
        user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
        audio_report_interval_ms INTEGER NOT NULL DEFAULT 100,
        rolling_window_ms INTEGER NOT NULL DEFAULT 2000,
        cooldown_ms INTEGER NOT NULL DEFAULT 3000,
        activity_threshold REAL NOT NULL DEFAULT 0.15,
        silence_threshold REAL NOT NULL DEFAULT 0.05,
        max_players_per_room INTEGER NOT NULL DEFAULT 10,
        max_active_rooms INTEGER NOT NULL DEFAULT 5,
        score_emit_interval_ms INTEGER NOT NULL DEFAULT 500,
        idle_timeout_ms INTEGER NOT NULL DEFAULT 60000,
        transition_type TEXT NOT NULL DEFAULT 'cut',
        transition_duration_ms INTEGER NOT NULL DEFAULT 0
      )
    `)
  },
}
