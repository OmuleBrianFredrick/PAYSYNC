CREATE TABLE `audit_log` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`session_id` integer,
	`action` text NOT NULL,
	`details` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`session_id`) REFERENCES `payment_sessions`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `idx_audit_session_created` ON `audit_log` (`session_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `contacts` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`session_id` integer NOT NULL,
	`name_on_file` text NOT NULL,
	`phone` text NOT NULL,
	`network` text NOT NULL,
	`amount` real NOT NULL,
	`registered_name` text,
	`names_match` integer,
	`payment_status` text DEFAULT 'pending' NOT NULL,
	`retry_count` integer DEFAULT 0 NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`session_id`) REFERENCES `payment_sessions`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uq_contacts_session_phone` ON `contacts` (`session_id`,`phone`);--> statement-breakpoint
CREATE INDEX `idx_contacts_payable` ON `contacts` (`session_id`,`payment_status`,`names_match`);--> statement-breakpoint
CREATE TABLE `payment_sessions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`reference` text NOT NULL,
	`name` text NOT NULL,
	`source` text NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`batch_size` integer DEFAULT 10 NOT NULL,
	`total_contacts` integer NOT NULL,
	`total_amount` real NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `payment_sessions_reference_unique` ON `payment_sessions` (`reference`);--> statement-breakpoint
CREATE INDEX `idx_payment_sessions_status_created` ON `payment_sessions` (`status`,`created_at`);