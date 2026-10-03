CREATE TABLE "community" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"description" text NOT NULL,
	"cover_key" text,
	"visibility" text DEFAULT 'public' NOT NULL,
	"owner_id" text NOT NULL,
	"member_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "community_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "community_member" (
	"community_id" text NOT NULL,
	"user_id" text NOT NULL,
	"role" text DEFAULT 'member' NOT NULL,
	"joined_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "community_member_community_id_user_id_pk" PRIMARY KEY("community_id","user_id")
);
--> statement-breakpoint
ALTER TABLE "community" ADD CONSTRAINT "community_owner_id_user_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "community_member" ADD CONSTRAINT "community_member_community_id_community_id_fk" FOREIGN KEY ("community_id") REFERENCES "public"."community"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "community_member" ADD CONSTRAINT "community_member_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "community_discover_idx" ON "community" USING btree ("member_count","id");--> statement-breakpoint
CREATE INDEX "community_owner_idx" ON "community" USING btree ("owner_id");--> statement-breakpoint
CREATE INDEX "community_member_user_idx" ON "community_member" USING btree ("user_id","joined_at");