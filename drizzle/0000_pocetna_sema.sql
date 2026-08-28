CREATE TABLE "destinacije" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"drzava" text NOT NULL,
	"drzava_sifra" text NOT NULL,
	"regija" text NOT NULL,
	"grad" text NOT NULL,
	"aktivna" boolean DEFAULT true NOT NULL,
	"redosled" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "destinacije_kljuc" UNIQUE("drzava_sifra","regija","grad")
);
--> statement-breakpoint
CREATE TABLE "profiles" (
	"id" uuid PRIMARY KEY NOT NULL,
	"ime" text NOT NULL,
	"email" text NOT NULL,
	"boja" text NOT NULL,
	CONSTRAINT "profiles_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "reservations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"ime" text NOT NULL,
	"telefon" text NOT NULL,
	"destinacija_id" uuid NOT NULL,
	"datum_polaska" date NOT NULL,
	"destinacija_povratka_id" uuid NOT NULL,
	"datum_povratka" date,
	"broj_putnika" integer NOT NULL,
	"kreirao" uuid NOT NULL,
	CONSTRAINT "reservations_broj_putnika_pozitivan" CHECK ("reservations"."broj_putnika" > 0),
	CONSTRAINT "reservations_povratak_posle_polaska" CHECK ("reservations"."datum_povratka" is null or "reservations"."datum_povratka" >= "reservations"."datum_polaska")
);
--> statement-breakpoint
CREATE TABLE "settings" (
	"id" integer PRIMARY KEY DEFAULT 1 NOT NULL,
	"podrazumevana_destinacija_id" uuid NOT NULL,
	CONSTRAINT "settings_jedan_red" CHECK ("settings"."id" = 1)
);
--> statement-breakpoint
ALTER TABLE "reservations" ADD CONSTRAINT "reservations_destinacija_id_destinacije_id_fk" FOREIGN KEY ("destinacija_id") REFERENCES "public"."destinacije"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reservations" ADD CONSTRAINT "reservations_destinacija_povratka_id_destinacije_id_fk" FOREIGN KEY ("destinacija_povratka_id") REFERENCES "public"."destinacije"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reservations" ADD CONSTRAINT "reservations_kreirao_profiles_id_fk" FOREIGN KEY ("kreirao") REFERENCES "public"."profiles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "settings" ADD CONSTRAINT "settings_podrazumevana_destinacija_id_destinacije_id_fk" FOREIGN KEY ("podrazumevana_destinacija_id") REFERENCES "public"."destinacije"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "destinacije_drzava_sifra_idx" ON "destinacije" USING btree ("drzava_sifra");--> statement-breakpoint
CREATE INDEX "destinacije_aktivna_idx" ON "destinacije" USING btree ("aktivna");--> statement-breakpoint
CREATE INDEX "reservations_datum_polaska_idx" ON "reservations" USING btree ("datum_polaska");--> statement-breakpoint
CREATE INDEX "reservations_datum_povratka_idx" ON "reservations" USING btree ("datum_povratka");