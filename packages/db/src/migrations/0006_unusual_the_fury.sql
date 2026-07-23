ALTER TABLE "post" ADD COLUMN "quoted_post_id" text;--> statement-breakpoint
ALTER TABLE "post" ADD CONSTRAINT "post_quoted_post_id_post_id_fk" FOREIGN KEY ("quoted_post_id") REFERENCES "public"."post"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "post_quotedPost_idx" ON "post" USING btree ("quoted_post_id");