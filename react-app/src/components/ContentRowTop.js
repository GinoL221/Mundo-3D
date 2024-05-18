import React from 'react';
import imagenFondo from '../assets/images/mandalorian.jpg'
import TotalProductos from './ProductList';
import CategoryList from './CategoryList';
import LatestProduct from './LastestProduct';
function ContentRowTop(){
    return(
        <React.Fragment>
				{/*<!-- Content Row Top -->*/}
				<div className="container-fluid">
					<div className="d-sm-flex aligns-items-center justify-content-between mb-4">
						<h1 className="h3 mb-0 text-gray-800"></h1>
					</div>
				

					{/*<!-- End movies in Data Base -->*/}
					
	
					{/*<!-- Content Row Last Movie in Data Base -->*/}
					<div className="row">
						{/*<!-- Last Movie in DB -->*/}
						
						<div className="col-lg-6 mb-4">						
							<div className="card shadow mb-4">
								<div className="card-header py-3">
									<h5 className="m-0 font-weight-bold text-gray-800">Ultimo producto agregado</h5>
								</div>
								<div className="card-body">
									<div className="row ">
										<LatestProduct/>
									</div>
								</div>
							</div>
						</div>
						{/*<!-- End content row last movie in Data Base -->*/}

						{/*<!-- Genres in DB -->*/}
						<div className="col-lg-6 mb-4">						
							<div className="card shadow mb-4">
								<div className="card-header py-3">
									<h5 className="m-0 font-weight-bold text-gray-800">Categorías</h5>
								</div>
								<div className="card-body">
									<div className="row">
										<CategoryList/>
									</div>
								</div>
							</div>
						</div>
						<div className="col-lg-12 mb-4">						
							<div className="card shadow mb-4">
								<div className="card-header py-3">
									<h5 className="m-0 font-weight-bold text-gray-800">Todos los Productos</h5>
								</div>
								<div className="card-body">
									<div className="row">
										<TotalProductos/>
									</div>
								</div>
							</div>
						</div>
					</div>
				</div>
				{/*<!--End Content Row Top-->*/}

        </React.Fragment>
    )

}
export default ContentRowTop;