import { NodeBootstrapApi } from '../../contexts/networks/infrastructure/http/NodeBootstrapApi';
import { ApiUrlBuilder } from '../../shared/infrastructure/http/ApiUrlBuilder';
import { HttpJsonClient } from '../../shared/infrastructure/http/HttpJsonClient';
import { API_SERVER_URL } from '../API_SERVER_URL';

export const nodeBootstrapApi = new NodeBootstrapApi(
  new HttpJsonClient(new ApiUrlBuilder(API_SERVER_URL)),
);
