ALTER TABLE `metrics` ADD `goal_direction` text;
--> statement-breakpoint
UPDATE `metrics` SET `goal_direction` = 'at_least' WHERE `goal` IS NOT NULL;