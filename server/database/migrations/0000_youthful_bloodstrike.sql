CREATE TABLE `ai_configs` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` integer NOT NULL,
	`name` text DEFAULT '默认模型' NOT NULL,
	`purpose` text NOT NULL,
	`api_url` text NOT NULL,
	`api_key` text NOT NULL,
	`model` text NOT NULL,
	`temperature` text DEFAULT '0.7',
	`max_tokens` integer DEFAULT 4096,
	`is_default` integer DEFAULT false NOT NULL,
	`enabled` integer DEFAULT true NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `chapter_notes` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`chapter_id` integer NOT NULL,
	`content` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`chapter_id`) REFERENCES `chapters`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `chapter_versions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`chapter_id` integer NOT NULL,
	`version_number` integer NOT NULL,
	`content` text NOT NULL,
	`source` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`chapter_id`) REFERENCES `chapters`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `chapters` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`novel_id` integer NOT NULL,
	`chapter_number` integer NOT NULL,
	`title` text NOT NULL,
	`content` text,
	`summary` text,
	`status` text DEFAULT 'draft' NOT NULL,
	`word_count` integer DEFAULT 0,
	`deleted_at` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`novel_id`) REFERENCES `novels`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `characters` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`novel_id` integer NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`traits` text,
	`relationships` text,
	`current_state` text,
	`first_appearance_chapter` integer,
	`last_appearance_chapter` integer,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`novel_id`) REFERENCES `novels`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `generation_tasks` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`novel_id` integer NOT NULL,
	`chapter_id` integer,
	`type` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`result` text,
	`error` text,
	`retry_count` integer DEFAULT 0,
	`tokens_used` integer,
	`created_at` integer NOT NULL,
	`completed_at` integer,
	FOREIGN KEY (`novel_id`) REFERENCES `novels`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`chapter_id`) REFERENCES `chapters`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `novel_outlines` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`novel_id` integer NOT NULL,
	`chapter_number` integer NOT NULL,
	`description` text NOT NULL,
	`sort_order` integer NOT NULL,
	FOREIGN KEY (`novel_id`) REFERENCES `novels`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `novel_templates` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`genre` text NOT NULL,
	`default_style_guide` text,
	`default_ai_prompt` text,
	`default_temperature` text DEFAULT '0.7'
);
--> statement-breakpoint
CREATE TABLE `novels` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` integer NOT NULL,
	`title` text NOT NULL,
	`description` text,
	`genre` text,
	`status` text DEFAULT 'draft' NOT NULL,
	`style_guide` text,
	`world_setting` text,
	`ai_temperature` text,
	`ai_extra_prompt` text,
	`deleted_at` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `plot_points` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`novel_id` integer NOT NULL,
	`chapter_id` integer,
	`description` text NOT NULL,
	`type` text NOT NULL,
	`status` text DEFAULT 'introduced' NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`novel_id`) REFERENCES `novels`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`chapter_id`) REFERENCES `chapters`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `prompt_templates` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` integer,
	`name` text NOT NULL,
	`content` text NOT NULL,
	`category` text NOT NULL,
	`is_system` integer DEFAULT false,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `site_config` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `story_arcs` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`novel_id` integer NOT NULL,
	`title` text NOT NULL,
	`summary` text,
	`start_chapter` integer NOT NULL,
	`end_chapter` integer,
	FOREIGN KEY (`novel_id`) REFERENCES `novels`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `token_usage` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` integer NOT NULL,
	`ai_config_id` integer,
	`tokens_input` integer NOT NULL,
	`tokens_output` integer NOT NULL,
	`estimated_cost` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`ai_config_id`) REFERENCES `ai_configs`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `user_preferences` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` integer NOT NULL,
	`key` text NOT NULL,
	`value` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `users` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`username` text NOT NULL,
	`password_hash` text NOT NULL,
	`role` text DEFAULT 'user' NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_username_unique` ON `users` (`username`);--> statement-breakpoint
CREATE TABLE `writing_stats` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` integer NOT NULL,
	`date` text NOT NULL,
	`words_written` integer DEFAULT 0,
	`chapters_completed` integer DEFAULT 0,
	`ai_generations` integer DEFAULT 0,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
