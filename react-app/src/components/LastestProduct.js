import React, { useState, useEffect } from "react";

const LatestProduct = () => {
  const [latestProduct, setLatestProduct] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("http://localhost:3031/api/products/latest")
      .then((response) => response.json())
      .then((data) => {
        setLatestProduct(data);
        setLoading(false);
      })
      .catch((error) => console.error("Error fetching latest product:", error));
  }, []);

  return (
    <div className="container">
      <h2 className="text-center">Último Producto Agregado</h2>
      {loading ? (
        <p className="text-center">Cargando el último producto...</p>
      ) : latestProduct ? (
        <div className="justify-content-center align-items-center">
          <div className="card-header py-3">
            <h5 className="m-0 font-weight-bold text-gray-800">
              {latestProduct.NameProduct}
            </h5>
          </div>
          <div className="card-body">
            <p className="h5 mb-0 font-weight-bold text-gray-800">
              ID: {latestProduct.IDProduct}
            </p>
            <p className="h5 mb-0 font-weight-bold text-gray-800">
              Precio: ${latestProduct.Price}
            </p>
            <p className="h5 mb-0 font-weight-bold text-gray-800">
              Descripción: {latestProduct.DescriptionProduct}
            </p>
            <p className="h5 mb-0 font-weight-bold text-gray-800">
              Categoría: {latestProduct.Category}
            </p>
            {latestProduct.Image && (
              <img
                src={`http://localhost:3031/img/products/${latestProduct.Image}`}
                alt={latestProduct.NameProduct}
                className="img-fluid col-md-4"
              />
            )}
            {/* Agrega más detalles según tus necesidades */}
          </div>
        </div>
      ) : (
        <p>No hay información disponible sobre el último producto.</p>
      )}
    </div>
  );
};

export default LatestProduct;
