CREATE TABLE "bot_config" (
	"user_id" text PRIMARY KEY NOT NULL,
	"owner_id" text NOT NULL,
	"system_prompt" text NOT NULL,
	"post_interval_minutes" integer NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"last_posted_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "is_bot" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "bot_config" ADD CONSTRAINT "bot_config_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bot_config" ADD CONSTRAINT "bot_config_owner_id_user_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "bot_config_owner_idx" ON "bot_config" USING btree ("owner_id");