-- Disable foreign key checks to prevent lock/constraint errors during column rename
SET FOREIGN_KEY_CHECKS = 0;

-- Rename Category table columns
ALTER TABLE `Category` RENAME COLUMN `IDCategory` TO `id_category`;
ALTER TABLE `Category` RENAME COLUMN `NameCategory` TO `name_category`;

-- Rename Franchise table columns
ALTER TABLE `Franchise` RENAME COLUMN `IDFranchise` TO `id_franchise`;
ALTER TABLE `Franchise` RENAME COLUMN `NameFranchise` TO `name_franchise`;

-- Rename foreign key columns in Product table
ALTER TABLE `Product` RENAME COLUMN `IDCategory` TO `id_category`;
ALTER TABLE `Product` RENAME COLUMN `IDFranchise` TO `id_franchise`;

-- Re-enable foreign key checks
SET FOREIGN_KEY_CHECKS = 1;
