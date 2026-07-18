CREATE TABLE "post_media" (
	"id" text PRIMARY KEY NOT NULL,
	"post_id" text NOT NULL,
	"file_id" text NOT NULL,
	"file_path" text NOT NULL,
	"width" integer NOT NULL,
	"height" integer NOT NULL,
	"format" text NOT NULL,
	"bytes" integer NOT NULL,
	"alt_text" text,
	"position" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "post_media" ADD CONSTRAINT "post_media_post_id_post_id_fk" FOREIGN KEY ("post_id") REFERENCES "public"."post"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "post_media_post_position_idx" ON "post_media" USING btree ("post_id","position");