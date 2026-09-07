ALTER TABLE "reservations" ADD COLUMN "adresa" text;--> statement-breakpoint
ALTER TABLE "reservations" ADD COLUMN "cena" integer;--> statement-breakpoint
ALTER TABLE "reservations" ADD COLUMN "napomena" text;--> statement-breakpoint
ALTER TABLE "reservations" ADD CONSTRAINT "reservations_cena_nenegativna" CHECK ("reservations"."cena" is null or "reservations"."cena" >= 0);