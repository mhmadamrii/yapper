CREATE TABLE "hashtag_mention" (
	"id" text PRIMARY KEY NOT NULL,
	"hashtag" text NOT NULL,
	"post_id" text NOT NULL,
	"author_id" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "trending_topic" (
	"hashtag" text PRIMARY KEY NOT NULL,
	"rank" integer NOT NULL,
	"score" double precision NOT NULL,
	"recent_authors" integer NOT NULL,
	"computed_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "hashtag_mention" ADD CONSTRAINT "hashtag_mention_post_id_post_id_fk" FOREIGN KEY ("post_id") REFERENCES "public"."post"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hashtag_mention" ADD CONSTRAINT "hashtag_mention_author_id_user_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "hashtag_mention_created_idx" ON "hashtag_mention" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "hashtag_mention_tag_created_idx" ON "hashtag_mention" USING btree ("hashtag","created_at" DESC NULLS LAST);