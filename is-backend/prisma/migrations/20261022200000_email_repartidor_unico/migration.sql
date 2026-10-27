-- El probador y el script de usuarios de prueba creaban varios repartidores con el mismo email.
-- Para que el índice único se pueda crear en las bases locales, a los repetidos (todos menos el
-- de menor id) se les agrega su id: "prueba@example.com" -> "prueba+42@example.com".
-- En una base sin repetidos no cambia nada.
UPDATE "repartidores" AS r
SET "email" = regexp_replace(r."email", '@', '+' || r."id" || '@')
WHERE EXISTS (
  SELECT 1 FROM "repartidores" AS otro
  WHERE otro."email" = r."email" AND otro."id" < r."id"
);

-- CreateIndex
CREATE UNIQUE INDEX "repartidores_email_key" ON "repartidores"("email");
