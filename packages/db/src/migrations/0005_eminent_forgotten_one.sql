CREATE TABLE "draft_media" (
	"id" text PRIMARY KEY NOT NULL,
	"draft_id" text NOT NULL,
	"file_id" text NOT NULL,
	"file_path" text NOT NULL,
	"width" integer NOT NULL,
	"height" integer NOT NULL,
	"format" text NOT NULL,
	"bytes" integer NOT NULL,
	"alt_text" text,
	"position" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "post_draft" (
	"id" text PRIMARY KEY NOT NULL,
	"author_id" text NOT NULL,
	"content" text DEFAULT '' NOT NULL,
	"reply_to_post_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "draft_media" ADD CONSTRAINT "draft_media_draft_id_post_draft_id_fk" FOREIGN KEY ("draft_id") REFERENCES "public"."post_draft"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "post_draft" ADD CONSTRAINT "post_draft_author_id_user_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "post_draft" ADD CONSTRAINT "post_draft_reply_to_post_id_post_id_fk" FOREIGN KEY ("reply_to_post_id") REFERENCES "public"."post"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "draft_media_draft_position_idx" ON "draft_media" USING btree ("draft_id","position");--> statement-breakpoint
CREATE INDEX "post_draft_author_updated_idx" ON "post_draft" USING btree ("author_id","updated_at" DESC NULLS LAST,"id" DESC NULLS LAST);