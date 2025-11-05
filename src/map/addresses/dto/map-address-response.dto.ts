import { ApiProperty } from '@nestjs/swagger';

export class AddressGeometryDto {
  @ApiProperty({ example: 'Point' })
  type: string;

  @ApiProperty({
    type: 'array',
    items: {
      type: 'number',
    },
    example: [6.8636568, 53.3246772],
    description: 'Coordinates as [longitude, latitude]',
  })
  coordinates: [number, number];
}

export class AddressPropertiesDto {
  @ApiProperty({ example: 'be2a3225de8ac6a3' })
  hash: string;

  @ApiProperty({ example: '4' })
  number: string;

  @ApiProperty({ example: 'Oranjeweg' })
  street: string;

  @ApiProperty({ example: '' })
  unit: string;

  @ApiProperty({ example: 'Appingedam' })
  city: string;

  @ApiProperty({ example: '' })
  district: string;

  @ApiProperty({ example: '' })
  region: string;

  @ApiProperty({ example: '9901 CK' })
  postcode: string;

  @ApiProperty({ example: '0003010000126739' })
  id: string;
}

export class AddressFeatureDto {
  @ApiProperty({ example: 'Feature' })
  type: string;

  @ApiProperty()
  geometry: AddressGeometryDto;

  @ApiProperty()
  properties: AddressPropertiesDto;
}

export class MapAddressResponseDto {
  @ApiProperty({ example: 'FeatureCollection' })
  type: string;

  @ApiProperty({ type: [AddressFeatureDto] })
  features: AddressFeatureDto[];
}
