-- Datos de la Demo 1 (los mismos que `npm run db:seed:demo`, ver docs/guion-demo-1.md). ⚠️ BORRA TODO lo que hay en la base.
-- Antes de correrlo: reemplazar PEGAR_ACA_EL_PIN_SECRET por el PIN_SECRET de Render (Environment).
-- No guardes la query con el secreto pegado.

do $$
declare
  pin_secret text := 'PEGAR_ACA_EL_PIN_SECRET';
  -- Ayer a las 9:00 de Argentina, guardado en UTC como lo guarda Prisma.
  ayer timestamp := ((date_trunc('day', now() at time zone 'America/Argentina/Buenos_Aires')
                      - interval '1 day' + interval '9 hours')
                     at time zone 'America/Argentina/Buenos_Aires') at time zone 'UTC';
  alfabeto text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  envios jsonb := '[
    {"c":"Farmacia Plaza Moreno","t":"CHICO","dest":"Calle 50 567, 3° B","n":"Carlos","a":"Medina","dni":"25111222","final":"ENTREGADO","r":"Lucas",
     "previas":[{"r":"Mateo","res":"VENCIDA"},{"r":"Sofía","res":"RECHAZADA"}],"ev":"Evidencia: DNI verificado","obs":"Timbre 3B"},
    {"c":"Librería del Bosque","t":"MEDIANO","dest":"Calle 60 300","n":"Laura","a":"Méndez","dni":"26222333","final":"ENTREGADO","r":"Valentina","ev":"Evidencia: foto enviada por WhatsApp"},
    {"c":"Ferretería La Tuerca","t":"GRANDE","dest":"Calle 115 890","n":"Pablo","a":"Herrera","dni":"27333444","final":"ENTREGADO","r":"Juan",
     "ev":"Evidencia: DNI verificado, foto enviada por WhatsApp","obs":"Entregar en el portón"},
    {"c":"Kiosco Don Pepe","t":"CHICO","dest":"Calle 10 960","n":"Marcos","a":"Suárez","dni":"28444555","final":"CANCELADO","r":"Sofía"},
    {"c":"Kiosco Don Pepe","t":"CHICO","dest":"Calle 19 540","n":"Nicolás","a":"Acosta","dni":"29555666","final":"ENTREGADO","r":"Sofía"},
    {"c":"Kiosco Don Pepe","t":"CHICO","dest":"Calle 6 1300","n":"Lucía","a":"Benítez","dni":"30666777","final":"ENTREGADO","r":"Lucas"},
    {"c":"Librería del Bosque","t":"CHICO","dest":"Calle 44 980","n":"Julia","a":"Castro","dni":"31777888","final":"ENTREGADO","r":"Mateo","ev":"Evidencia: foto enviada por WhatsApp"},
    {"c":"Kiosco Don Pepe","t":"CHICO","dest":"Calle 1 220","n":"Ramiro","a":"Vega","dni":"32888999","final":"ENTREGADO","r":"Mateo"}
  ]';
  op_id int;
  e jsonb;
  i int;
  previa jsonb;
  k int;
  com record;
  rep_id int;
  envio_id int;
  camino text[];
  creado timestamp;
  arranque int;
  paso int;
  t timestamp;
  codigo text;
  creada timestamp;
begin
  if pin_secret = 'PEGAR_ACA_EL_PIN_SECRET' then
    raise exception 'Falta pegar el PIN_SECRET de Render en la primera línea del bloque';
  end if;

  truncate ofertas, eventos_envio, envios, refresh_tokens, repartidores, comercios, operarios restart identity cascade;

  -- Operario: admin / admin1234 (hash argon2 de esa contraseña).
  insert into operarios (usuario, nombre, password_hash)
  values ('admin', 'Ana Pérez', '$argon2id$v=19$m=65536,p=4,t=3$uVjOeCrJUqgywCCDaGRT6w$sU4X8xspdr59PFd4N0dRZ9OjiuLKUDL14B5uPWHcuZw')
  returning id into op_id;

  insert into comercios (nombre, direccion, telefono, email, requiere_foto, requiere_dni, actualizado_en) values
    ('Kiosco Don Pepe',       'Calle 7 1234',     '221 400-0010', 'comercio1@example.com', false, false, now()),
    ('Librería del Bosque',   'Calle 8 845',      '221 400-0020', 'comercio2@example.com', true,  false, now()),
    ('Farmacia Plaza Moreno', 'Calle 12 1020',    '221 400-0030', 'comercio3@example.com', false, true,  now()),
    ('Ferretería La Tuerca',  'Diagonal 74 1520', '221 400-0040', 'comercio4@example.com', true,  true,  now()),
    ('Heladería Polo Norte',  'Calle 47 610',     '221 400-0050', 'comercio5@example.com', false, false, now());

  -- PIN = número de fila repetido (1111, 2222…). Martina en emergencia, Tomás dado de baja.
  insert into repartidores (nombre, apellido, telefono, email, dni, direccion, vehiculo, pin_hmac, estado, activo, viajes_consecutivos, actualizado_en)
  select nombre, apellido, '221 500-00' || n || '0', 'repartidor' || n || '@example.com', (30000000 + n)::text, 'La Plata',
         vehiculo::"TipoVehiculo", encode(extensions.hmac(repeat(n::text, 4), pin_secret, 'sha256'), 'hex'),
         estado::"EstadoRepartidor", activo, seguidos, now()
  from (values
    (1, 'Lucas',     'Gómez',   'MOTO',   'FUERA_DE_JORNADA', true,  2),
    (2, 'Sofía',     'Díaz',    'MOTO',   'FUERA_DE_JORNADA', true,  1),
    (3, 'Mateo',     'Ruiz',    'MOTO',   'FUERA_DE_JORNADA', true,  2),
    (4, 'Valentina', 'López',   'AUTO',   'FUERA_DE_JORNADA', true,  1),
    (5, 'Tomás',     'Pérez',   'AUTO',   'FUERA_DE_JORNADA', false, 0),
    (6, 'Juan',      'Romero',  'CAMION', 'FUERA_DE_JORNADA', true,  1),
    (7, 'Martina',   'Álvarez', 'CAMION', 'EMERGENCIA',       true,  0)
  ) as r(n, nombre, apellido, vehiculo, estado, activo, seguidos)
  order by n;

  -- Envíos de ayer: cada uno arranca 40 min después del anterior; cada paso tarda 6 min.
  for e, i in select value, ordinality from jsonb_array_elements(envios) with ordinality loop
    select id, direccion, requiere_foto, requiere_dni into com from comercios where nombre = e->>'c';
    select id into rep_id from repartidores where nombre = e->>'r';
    camino := case e->>'final'
      when 'ENTREGADO' then array['PENDIENTE','ASIGNADO','EN_CAMINO_A_RETIRAR','RETIRADO','EN_DOMICILIO','ENTREGADO']
      else array['PENDIENTE','ASIGNADO','CANCELADO'] end;
    creado := ayer + make_interval(mins => (i - 1) * 40);
    arranque := 1 + coalesce(jsonb_array_length(e->'previas'), 0) * 6;
    select string_agg(substr(alfabeto, 1 + floor(random() * 32)::int, 1), '') into codigo from generate_series(1, 10);

    insert into envios (codigo_seguimiento, comercio_id, origen_direccion, destino_direccion, destinatario_nombre,
                        destinatario_apellido, destinatario_telefono, destinatario_dni, tamanio, vehiculo_requerido,
                        observaciones, requiere_foto, requiere_dni, estado, repartidor_id, creado_en, actualizado_en)
    values (codigo, com.id, com.direccion, e->>'dest', e->>'n', e->>'a', '221 600-0' || lpad((i - 1)::text, 3, '0'), e->>'dni',
            (e->>'t')::"TamanioPaquete",
            (case e->>'t' when 'CHICO' then 'MOTO' when 'MEDIANO' then 'AUTO' else 'CAMION' end)::"TipoVehiculo",
            e->>'obs', com.requiere_foto, com.requiere_dni, (e->>'final')::"EstadoEnvio", rep_id, creado, now())
    returning id into envio_id;

    insert into eventos_envio (envio_id, tipo, estado_nuevo, actor_tipo, actor_id, creado_en)
    values (envio_id, 'CREADO', 'PENDIENTE', 'OPERARIO', op_id, creado);

    k := 0;
    for previa in select value from jsonb_array_elements(coalesce(e->'previas', '[]')) loop
      creada := creado + make_interval(mins => 1 + k * 6);
      insert into ofertas (envio_id, repartidor_id, estado, creada_en, expira_en, respondida_en)
      select envio_id, id, (previa->>'res')::"EstadoOferta", creada, creada + interval '5 minutes',
             case when previa->>'res' = 'RECHAZADA' then creada + interval '1 minute' end
      from repartidores where nombre = previa->>'r';
      k := k + 1;
    end loop;

    for paso in 2 .. array_length(camino, 1) loop
      t := creado + make_interval(mins => arranque + (paso - 2) * 6);
      if camino[paso] = 'ASIGNADO' then
        insert into ofertas (envio_id, repartidor_id, estado, creada_en, expira_en, respondida_en)
        values (envio_id, rep_id, 'ACEPTADA', t - interval '1 minute', t + interval '4 minutes', t);
      end if;
      insert into eventos_envio (envio_id, tipo, estado_anterior, estado_nuevo, detalle, actor_tipo, actor_id, creado_en)
      values (envio_id, 'CAMBIO_ESTADO', camino[paso - 1]::"EstadoEnvio", camino[paso]::"EstadoEnvio",
              case when camino[paso] = 'ENTREGADO' then e->>'ev' end,
              (case when camino[paso] = 'CANCELADO' then 'OPERARIO' else 'REPARTIDOR' end)::"TipoActor",
              case when camino[paso] = 'CANCELADO' then op_id else rep_id end, t);
    end loop;
  end loop;
end $$;

-- Resumen: PINs y códigos de seguimiento para tener a mano.
select 'Repartidor' as que, repeat(id::text, 4) as pin_o_codigo,
       nombre || ' ' || apellido || ' (' || vehiculo || ')' ||
       case when not activo then ' — dado de baja' when estado = 'EMERGENCIA' then ' — en emergencia'
            when viajes_consecutivos >= 2 then ' — 2 viajes seguidos' else '' end as detalle
from repartidores
union all
select 'Envío de ayer', e.codigo_seguimiento,
       e.destinatario_nombre || ' ' || e.destinatario_apellido || ' — ' || c.nombre || ', ' || lower(e.estado::text)
from envios e join comercios c on c.id = e.comercio_id
order by 1 desc, 2;
