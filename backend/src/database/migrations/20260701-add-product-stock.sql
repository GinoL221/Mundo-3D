-- Add stock column to Product table
ALTER TABLE `Product` ADD COLUMN `stock` INT NOT NULL DEFAULT 0;
