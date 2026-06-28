-- Disable foreign key checks to prevent lock/constraint errors during column rename
SET FOREIGN_KEY_CHECKS = 0;

-- Rename Product table columns
ALTER TABLE `Product` RENAME COLUMN `IDProduct` TO `id_product`;
ALTER TABLE `Product` RENAME COLUMN `NameProduct` TO `name_product`;
ALTER TABLE `Product` RENAME COLUMN `Price` TO `price`;
ALTER TABLE `Product` RENAME COLUMN `DescriptionProduct` TO `description_product`;
ALTER TABLE `Product` RENAME COLUMN `Image` TO `image`;

-- Rename foreign key column in ShoppingCart table
ALTER TABLE `ShoppingCart` RENAME COLUMN `IDProduct` TO `id_product`;

-- Re-enable foreign key checks
SET FOREIGN_KEY_CHECKS = 1;
