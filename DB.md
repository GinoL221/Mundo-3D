-- Crear la base de datos
CREATE DATABASE IF NOT EXISTS ecommerce_dbtest;
USE ecommerce_dbtest;

-- Tabla de Categorías con restricción de clave única en NameCategory
CREATE TABLE IF NOT EXISTS Category (
IDCategory INT PRIMARY KEY AUTO_INCREMENT,
NameCategory VARCHAR(255) NOT NULL,
UNIQUE KEY uk_namecategory (NameCategory)
);

-- Agregar nuevas categorías
INSERT INTO Category (NameCategory) VALUES ('Llavero');
INSERT INTO Category (NameCategory) VALUES ('Busto');
INSERT INTO Category (NameCategory) VALUES ('Figura');
INSERT INTO Category (NameCategory) VALUES ('Mascara');
INSERT INTO Category (NameCategory) VALUES ('Otras');

-- Tabla de Franquicias
CREATE TABLE IF NOT EXISTS Franchise (
IDFranchise INT PRIMARY KEY AUTO_INCREMENT,
NameFranchise VARCHAR(255) NOT NULL,
UNIQUE KEY uk_namefranchise (NameFranchise)
);

-- Insertar datos en la tabla Franchise
INSERT INTO Franchise (NameFranchise) VALUES ('Marvel');
INSERT INTO Franchise (NameFranchise) VALUES ('DC');
INSERT INTO Franchise (NameFranchise) VALUES ('Disney');
INSERT INTO Franchise (NameFranchise) VALUES ('Otra');

-- Tabla de Usuarios con restricción de clave única en Email
CREATE TABLE IF NOT EXISTS User (
IDUser INT PRIMARY KEY AUTO_INCREMENT,
FirstName VARCHAR(255) NOT NULL,
LastName VARCHAR(255) NOT NULL,
Email VARCHAR(255) NOT NULL,
Image VARCHAR(255),
PasswordUser VARCHAR(64) NOT NULL,
UNIQUE KEY uk_email (Email)
);

-- Tabla de Productos con índice en IDCategory y FranchiseID
CREATE TABLE IF NOT EXISTS Product (
IDProduct INT PRIMARY KEY AUTO_INCREMENT,
IDCategory INT NOT NULL,
IDFranchise INT NOT NULL,
NameProduct VARCHAR(255) NOT NULL,
Price DECIMAL(10, 2) NOT NULL,
DescriptionProduct TEXT,
Image VARCHAR(255),
INDEX idx_idcategory (IDCategory),
INDEX idx_franchise_id (IDFranchise),
CONSTRAINT fk_category
FOREIGN KEY (IDCategory)
REFERENCES Category(IDCategory),
CONSTRAINT fk_franchise
FOREIGN KEY (IDFranchise)
REFERENCES Franchise(IDFranchise)
);

-- Tabla de Carrito de Compras con índice único en IDUser e IDProduct
CREATE TABLE IF NOT EXISTS ShoppingCart (
IDCart INT PRIMARY KEY AUTO_INCREMENT,
IDUser INT NOT NULL,
IDProduct INT NOT NULL,
Quantity INT NOT NULL,
UnitPrice DECIMAL(10, 2) NOT NULL,
CartStatus VARCHAR(50) NOT NULL,
FOREIGN KEY (IDUser) REFERENCES User(IDUser),
FOREIGN KEY (IDProduct) REFERENCES Product(IDProduct),
UNIQUE KEY idx_user_product (IDUser, IDProduct)
);
