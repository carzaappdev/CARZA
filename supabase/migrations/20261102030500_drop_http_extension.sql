-- The `http` extension was only used once, by hand, to load the first migrations onto the hosted project.
-- Nothing in the schema calls it, and an outbound HTTP client inside the database is attack surface.
drop extension if exists http;
