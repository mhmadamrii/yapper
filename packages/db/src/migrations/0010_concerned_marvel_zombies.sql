CREATE TABLE "interest" (
	"slug" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"order" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_interest" (
	"user_id" text NOT NULL,
	"interest_slug" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "user_interest_user_id_interest_slug_pk" PRIMARY KEY("user_id","interest_slug")
);
--> statement-breakpoint
ALTER TABLE "post_draft" ADD COLUMN "interest_slug" text;--> statement-breakpoint
ALTER TABLE "post" ADD COLUMN "interest_slug" text;--> statement-breakpoint
ALTER TABLE "user_interest" ADD CONSTRAINT "user_interest_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_interest" ADD CONSTRAINT "user_interest_interest_slug_interest_slug_fk" FOREIGN KEY ("interest_slug") REFERENCES "public"."interest"("slug") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "user_interest_interest_idx" ON "user_interest" USING btree ("interest_slug");--> statement-breakpoint
ALTER TABLE "post_draft" ADD CONSTRAINT "post_draft_interest_slug_interest_slug_fk" FOREIGN KEY ("interest_slug") REFERENCES "public"."interest"("slug") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "post" ADD CONSTRAINT "post_interest_slug_interest_slug_fk" FOREIGN KEY ("interest_slug") REFERENCES "public"."interest"("slug") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "post_interest_idx" ON "post" USING btree ("interest_slug");