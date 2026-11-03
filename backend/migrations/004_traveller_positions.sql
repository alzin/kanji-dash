-- Where each signed-in learner stands on the shared world map, as their device last
-- reported it. stop is a region (chapter) id; seen_at is the last report from the map.
CREATE TABLE traveller_positions (
  user_id uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  stop smallint NOT NULL CHECK (stop BETWEEN 1 AND 1000),
  seals smallint NOT NULL CHECK (seals BETWEEN 0 AND 1000),
  anonymous boolean NOT NULL DEFAULT false,
  seen_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX traveller_positions_seen_at_idx ON traveller_positions (seen_at DESC);
