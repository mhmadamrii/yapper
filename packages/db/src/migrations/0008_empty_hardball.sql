CREATE TABLE "link_preview" (
	"url" text PRIMARY KEY NOT NULL,
	"status" text NOT NULL,
	"title" text,
	"description" text,
	"image_url" text,
	"site_name" text,
	"domain" text NOT NULL,
	"fetched_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "post" ADD COLUMN "link_preview_url" text;--> statement-breakpoint
CREATE INDEX "link_preview_fetchedAt_idx" ON "link_preview" USING btree ("fetched_at");--> statement-breakpoint
ALTER TABLE "post" ADD CONSTRAINT "post_link_preview_url_link_preview_url_fk" FOREIGN KEY ("link_preview_url") REFERENCES "public"."link_preview"("url") ON DELETE set null ON UPDATE no action;